// Smart-Fleet IoT — Zod Request Validator
// TanQHoang © 2026
// Usage: router.post('/path', validateRequest(schema), controller)

const { ZodError } = require('zod');

function validateRequest(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.reduce((acc, e) => {
          acc[e.path.join('.')] = e.message;
          return acc;
        }, {});

        return res.status(422).json({
          success: false,
          data: null,
          meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request body validation failed.',
            details,
          },
        });
      }
      return next(err);
    }
  };
}

module.exports = validateRequest;
