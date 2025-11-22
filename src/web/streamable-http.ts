/**
 * StreamableHTTP Transport for MCP (Web Implementation)
 * Implements the new single-endpoint transport protocol
 * 
 * @see https://modelcontextprotocol.io/specification/2025-03-26/basic/transports
 */

export interface StreamableHTTPCallback {
  onMessage: (message: any) => void;
  onError: (error: string) => void;
  onConnectionStateChange: (state: string) => void;
}

export class StreamableHTTPTransport {
  private endpointUrl: string;
  private callback: StreamableHTTPCallback;
  private resumable: boolean;
  private sessionId: string | null = null;
  private lastSequence: number = 0;
  private abortController: AbortController | null = null;
  private currentReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  constructor(
    endpointUrl: string,
    callback: StreamableHTTPCallback,
    resumable: boolean = false,
    sessionId?: string,
    lastSequence?: number
  ) {
    this.endpointUrl = endpointUrl;
    this.callback = callback;
    this.resumable = resumable;
    if (sessionId) this.sessionId = sessionId;
    if (lastSequence !== undefined) this.lastSequence = lastSequence;
  }

  /**
   * Send a JSON-RPC message to the server
   */
  async sendMessage(message: any, expectStream: boolean = false): Promise<void> {
    try {
      this.abortController = new AbortController();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Mcp-Protocol-Version': '2025-03-26',
      };

      // Add session headers for resumability
      if (this.resumable && this.sessionId) {
        headers['Mcp-Session-Id'] = this.sessionId;
        headers['Mcp-Sequence'] = String(this.lastSequence);
      }

      const response = await fetch(this.endpointUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(message),
        signal: this.abortController.signal,
      });

      // Extract session ID for resumability
      const newSessionId = response.headers.get('Mcp-Session-Id');
      if (newSessionId) {
        this.sessionId = newSessionId;
      }

      const contentType = response.headers.get('Content-Type') || '';

      if (contentType.includes('text/event-stream')) {
        // Handle SSE stream
        await this.handleSSEStream(response);
      } else if (contentType.includes('application/json')) {
        // Handle single JSON response
        await this.handleJSONResponse(response);
      } else if (response.status === 202) {
        // Accepted (for notifications/responses)
        this.callback.onConnectionStateChange('accepted');
      } else {
        // Error response
        const errorBody = await response.text();
        this.callback.onError(`HTTP ${response.status}: ${errorBody}`);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        this.callback.onError(`Send message failed: ${error.message}`);
      }
    }
  }

  /**
   * Open a GET stream to listen for server-initiated messages
   */
  async openListenStream(): Promise<void> {
    try {
      this.abortController = new AbortController();

      const headers: Record<string, string> = {
        'Accept': 'text/event-stream',
        'Mcp-Protocol-Version': '2025-03-26',
      };

      // Add session headers for resumability
      if (this.resumable && this.sessionId) {
        headers['Mcp-Session-Id'] = this.sessionId;
        headers['Mcp-Sequence'] = String(this.lastSequence);
      }

      const response = await fetch(this.endpointUrl, {
        method: 'GET',
        headers,
        signal: this.abortController.signal,
      });

      if (response.status === 405) {
        // Method Not Allowed - server doesn't support GET streams
        this.callback.onConnectionStateChange('get_not_supported');
        return;
      }

      const contentType = response.headers.get('Content-Type') || '';
      if (contentType.includes('text/event-stream')) {
        await this.handleSSEStream(response);
      } else {
        this.callback.onError(`Unexpected content type: ${contentType}`);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        this.callback.onError(`Listen stream failed: ${error.message}`);
      }
    }
  }

  /**
   * Handle SSE stream response
   */
  private async handleSSEStream(response: Response): Promise<void> {
    this.callback.onConnectionStateChange('streaming');

    if (!response.body) {
      this.callback.onError('Response body is null');
      return;
    }

    try {
      const reader = response.body.getReader();
      this.currentReader = reader;
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          this.callback.onConnectionStateChange('stream_closed');
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventData = '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            eventData += line.substring(6) + '\n';
          } else if (line === '') {
            // Empty line signals end of event
            if (eventData.trim()) {
              this.processSSEEvent(eventData.trim());
              eventData = '';
            }
          }
          // Ignore other SSE fields (event, id, retry) and comments
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        this.callback.onError(`SSE stream error: ${error.message}`);
      }
    } finally {
      this.currentReader = null;
    }
  }

  /**
   * Process an SSE event data
   */
  private processSSEEvent(eventData: string): void {
    try {
      const message = JSON.parse(eventData);

      // Update sequence number if present
      if (message._meta?.sequence !== undefined) {
        this.lastSequence = message._meta.sequence;
      }

      this.callback.onMessage(message);
    } catch (error: any) {
      this.callback.onError(`Failed to parse SSE event: ${error.message}`);
    }
  }

  /**
   * Handle single JSON response
   */
  private async handleJSONResponse(response: Response): Promise<void> {
    try {
      const message = await response.json();

      // Update sequence number if present
      if (message._meta?.sequence !== undefined) {
        this.lastSequence = message._meta.sequence;
      }

      this.callback.onMessage(message);
    } catch (error: any) {
      this.callback.onError(`Failed to parse JSON response: ${error.message}`);
    }
  }

  /**
   * Close the transport and cancel any active streams
   */
  close(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    if (this.currentReader) {
      this.currentReader.cancel();
    }
    this.callback.onConnectionStateChange('closed');
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Get the last sequence number
   */
  getLastSequence(): number {
    return this.lastSequence;
  }

  /**
   * Check if transport is resumable
   */
  isResumable(): boolean {
    return this.resumable;
  }
}
