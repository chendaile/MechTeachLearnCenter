import { McpTool, McpJsonRpcRequest, McpJsonRpcResponse } from "../types";

/**
 * A lightweight client for the Model Context Protocol (MCP) using SSE transport.
 * Reference: https://spec.modelcontextprotocol.io/transport/sse/
 */
export class McpClient {
    private eventSource: EventSource | null = null;
    private endpoint: string | null = null;
    private _isConnected: boolean = false;
    private requestCounter: number = 0;
    private pendingRequests: Map<string | number, (response: McpJsonRpcResponse) => void> = new Map();
    private _tools: McpTool[] = [];
    private _baseUrl: string = "";

    constructor() {}

    public get isConnected() {
        return this._isConnected;
    }

    public get tools() {
        return this._tools;
    }

    /**
     * Connects to an MCP server via SSE.
     * @param url The SSE endpoint URL (e.g., http://localhost:3000/sse)
     */
    public async connect(url: string): Promise<void> {
        this.disconnect();
        this._baseUrl = url;

        return new Promise((resolve, reject) => {
            try {
                this.eventSource = new EventSource(url);

                this.eventSource.onopen = () => {
                    console.log("[MCP] SSE Connection opened");
                };

                this.eventSource.onerror = (err) => {
                    console.error("[MCP] SSE Connection error", err);
                    if (!this._isConnected) {
                        reject(new Error("Failed to connect to MCP SSE endpoint"));
                    }
                    this.disconnect();
                };

                this.eventSource.addEventListener("endpoint", (event: MessageEvent) => {
                    // The server sends the POST endpoint for sending messages
                    this.endpoint = event.data;
                    
                    // Handle relative URLs
                    if (this.endpoint && !this.endpoint.startsWith('http')) {
                        const base = new URL(url);
                        // Careful with path joining
                        const basePath = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);
                        this.endpoint = new URL(this.endpoint, base.origin + basePath).toString();
                    }

                    console.log("[MCP] Received endpoint:", this.endpoint);
                    this.initialize().then(() => {
                        this._isConnected = true;
                        resolve();
                    }).catch(reject);
                });

                this.eventSource.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.handleMessage(data);
                    } catch (e) {
                        console.error("[MCP] Error parsing message", e);
                    }
                };

            } catch (error) {
                reject(error);
            }
        });
    }

    public disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        this.endpoint = null;
        this._isConnected = false;
        this._tools = [];
        this.pendingRequests.clear();
    }

    /**
     * Sends the 'initialize' handshake and then 'notifications/initialized'.
     */
    private async initialize() {
        console.log("[MCP] Initializing...");
        const initResult = await this.sendRequest("initialize", {
            protocolVersion: "2024-11-05", // Current spec version
            capabilities: {
                roots: { listChanged: true },
                sampling: {}
            },
            clientInfo: {
                name: "MechTeachLearnCenter-Web",
                version: "1.0.0"
            }
        });

        console.log("[MCP] Initialize result:", initResult);

        // Notify server that we are initialized
        await this.sendNotification("notifications/initialized");
        
        // Fetch tools immediately after initialization
        await this.refreshTools();
    }

    public async refreshTools(): Promise<McpTool[]> {
        if (!this._isConnected) throw new Error("Not connected");
        
        const response = await this.sendRequest("tools/list");
        if (response.result && response.result.tools) {
            this._tools = response.result.tools;
            console.log("[MCP] Discovered tools:", this._tools);
            return this._tools;
        }
        return [];
    }

    public async callTool(name: string, args: any): Promise<any> {
        if (!this._isConnected) throw new Error("Not connected");
        console.log(`[MCP] Calling tool ${name} with args:`, args);
        
        const response = await this.sendRequest("tools/call", {
            name: name,
            arguments: args
        });

        if (response.error) {
            throw new Error(response.error.message);
        }

        return response.result;
    }

    private async sendNotification(method: string, params?: any) {
        if (!this.endpoint) return;
        
        const message: McpJsonRpcRequest = {
            jsonrpc: "2.0",
            method: method,
            params: params,
            id: this.requestCounter++ // Notifications don't strictly need IDs in some specs, but JSON-RPC usually has them or null
        };
        // Actually notifications shouldn't expect a response, but for simplicity we use the same post method
        // Standard JSON-RPC 2.0 notification omits 'id'.
        const notificationPayload = { ...message };
        delete (notificationPayload as any).id;

        await fetch(this.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(notificationPayload)
        });
    }

    private async sendRequest(method: string, params?: any): Promise<McpJsonRpcResponse> {
        if (!this.endpoint) throw new Error("No endpoint discovered");

        const id = this.requestCounter++;
        const message: McpJsonRpcRequest = {
            jsonrpc: "2.0",
            id: id,
            method: method,
            params: params
        };

        return new Promise(async (resolve, reject) => {
            // Register callback
            this.pendingRequests.set(id, (response) => {
                if (response.error) {
                    // MCP Spec: Errors are returned in the response object
                    console.warn("[MCP] RPC Error:", response.error);
                }
                resolve(response);
            });

            // Set a timeout
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error(`Request ${method} timed out`));
                }
            }, 30000); // 30s timeout

            try {
                const res = await fetch(this.endpoint!, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(message)
                });

                if (!res.ok) {
                    this.pendingRequests.delete(id);
                    reject(new Error(`HTTP Error ${res.status}`));
                }
            } catch (err) {
                this.pendingRequests.delete(id);
                reject(err);
            }
        });
    }

    private handleMessage(data: McpJsonRpcResponse) {
        if (data.id !== undefined && this.pendingRequests.has(data.id)) {
            const callback = this.pendingRequests.get(data.id);
            this.pendingRequests.delete(data.id);
            if (callback) callback(data);
        } else {
            // Handle server-side notifications or requests (e.g. logging)
            if ((data as any).method) {
               console.log("[MCP] Server Notification:", data);
            }
        }
    }
}

export const mcpClient = new McpClient();
