
// promise based async handlers for express routes
const asyncHandlers = (requestHandler) => {
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next)).catch((error)=> next(error));
    }
}

export { asyncHandlers }

// A utility to wrap async route handlers and middlewares
// to catch errors and pass them to Express error handlers
// const asyncHandler = (fn) => async (req, res, next) => {
//     try {
//         await fn(req, res, next);
//     } catch (error) {
//         res.status(error.code || 500).json({
//             success: false,
//             message: error.message || "Internal Server Error"
//         })
//         next();
//     }
// }