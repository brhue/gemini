import tls from "tls";
import stream from "stream";

export enum StatusCodes {
  INPUT = 10,
  SENSITIVE_INPUT,
  SUCCESS = 20,
  REDIRECT_TEMPORARY = 30,
  REDIRECT_PERMANENT,
  TEMPORARY_FAILURE = 40,
  SERVER_UNAVAILABLE,
  CGI_ERROR,
  PROXY_ERROR,
  SLOW_DOWN,
  PERMANENT_FAILURE = 50,
  NOT_FOUND,
  GONE,
  PROXY_REQUEST_REFUSED,
  BAD_REQUEST = 59,
  CLIENT_CERTIFICATE_REQUIRED,
  CERTIFICATE_NOT_AUTHORIZED,
  CERTIFICATE_NOT_VALID,
}

export type GeminiRequest = {
  socket: tls.TLSSocket;
  url: string;
};

const CRLF = "\r\n";

class Server extends tls.Server {
  constructor(opts: tls.TlsOptions, requestListener?: (req: GeminiRequest, res: GeminiResponse) => void) {
    super(opts);
    if (requestListener) {
      this.on("request", requestListener);
    }
    this.on("secureConnection", secureConnectionListener);
  }
}

export class GeminiResponse extends stream.Writable {
  socket: tls.TLSSocket;
  header: string;
  statusCode?: number;
  statusMessage?: string;
  req;
  constructor(req: GeminiRequest) {
    super();
    this.req = req;
    this.socket = req.socket;
    this.header = "";
  }
  redirect(to: string) {
    this.setHead(31, to).send();
  }
  send(body?: string) {
    if (!this.header) {
      this.setHead(20, "text/gemini");
    }
    if (!body) {
      this.socket.end(this.header);
    } else {
      this.socket.write(this.header);
      this.socket.end(body);
    }
  }
  sendStatus(statusCode: StatusCodes) {
    this.socket.end(`${statusCode} ${StatusCodes[statusCode]}${CRLF}`);
  }
  status(code: number) {
    this.statusCode = code;
    return this;
  }
  setHead(status: number, message: string) {
    this.header = `${status} ${message}${CRLF}`;
    return this;
  }
}

function secureConnectionListener(this: Server, socket: tls.TLSSocket) {
  let chunks: Buffer[] = [];
  socket.on("data", (chunk) => {
    // Max URL length + CRLF
    if (chunk.length > 1026) {
      return socket.end(`59 BAD REQUEST - Invalid request length.`);
    }
    const crlfIndex = chunk.indexOf(CRLF);
    if (crlfIndex === -1) {
      // There might be more data coming?
      chunks.push(chunk);
    } else {
      let fullRequest;
      if (chunks.length > 0) {
        chunks.push(chunk);
        fullRequest = Buffer.concat(chunks);
      } else {
        fullRequest = chunk;
      }
      let requestUrl = fullRequest.slice(0, crlfIndex);
      const req: GeminiRequest = {
        socket,
        url: requestUrl.toString("utf8"),
      };
      let res = new GeminiResponse(req);
      this.emit("request", req, res);
    }
  });
}

export function createServer(opts: any, listener?: (req: GeminiRequest, res: GeminiResponse) => void) {
  return new Server(opts, listener);
}

type GeminiServerResponse = {
  url: string;
  statusCode: StatusCodes;
  meta: string;
  body?: Buffer;
};

export function request(url: URL): Promise<GeminiServerResponse> {
  return new Promise((resolve, reject) => {
    const options: tls.ConnectionOptions = {
      host: url.hostname,
      port: Number(url.port) || 1965,
      servername: url.hostname,
      rejectUnauthorized: false,
    };
    const socket = tls.connect(options, () => {
      // TODO: Server certificate validation via TOFU or something...
      socket.write(`${url.href}\r\n`);
    });
    socket.on("error", (error) => {
      // TODO: Better error handling.
      reject(`error: ${error}`);
    });
    const responseData: Buffer[] = [];
    socket.on("data", (data) => {
      responseData.push(data);
    });
    socket.on("end", () => {
      const fullResponse = Buffer.concat(responseData);
      const crlfIndex = fullResponse.indexOf("\r\n");
      const header = fullResponse.slice(0, crlfIndex).toString("utf8");
      const [status, meta] = parseHeader(header);
      resolve({
        url: url.toString(),
        statusCode: Number(status) as StatusCodes,
        meta,
        body: fullResponse.slice(crlfIndex + 2),
      });
    });
  });
}

function parseHeader(header: string) {
  const status = header.slice(0, 2);
  const meta = header.slice(2).trim();
  // TODO: Error handling
  return [status, meta];
}
