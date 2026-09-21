/**
 * Simple request logger - every API call is printed with method, path,
 * status and duration. Makes bugs like "who deleted my data" debuggable.
 */
function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const line = `${new Date().toISOString()} ${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`;

    if (res.statusCode >= 500) {
      console.error(line);
    } else if (res.statusCode >= 400 || req.method !== 'GET') {
      console.log(line);
    }
    // Successful GETs are not logged to keep the console readable
  });

  next();
}

module.exports = requestLogger;
