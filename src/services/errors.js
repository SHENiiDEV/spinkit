class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }

  toBody() {
    return { status: 'error', error: this.code, message: this.message, ...this.extra };
  }
}

const bad = (code, message, extra) => new ApiError(400, code, message, extra);
const notFound = (code, message) => new ApiError(404, code, message);

module.exports = { ApiError, bad, notFound };
