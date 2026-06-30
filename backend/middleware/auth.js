// const jwt = require("jsonwebtoken");

// module.exports = (req, res, next) => {
//   const authHeader = req.headers.authorization;

//   if (!authHeader || !authHeader.startsWith("Bearer ")) {
//     return res.status(401).json({ message: "Not authorized" });
//   }

//   try {
//     const token = authHeader.split(" ")[1];
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     req.user = { id: decoded.id, _id: decoded.id }; // 🔑 attach user
//     next();
//   } catch {
//     res.status(401).json({ message: "Invalid token" });
//   }
// };




const jwt = require("jsonwebtoken");

// Fail fast at module load time if JWT_SECRET is not set
if (!process.env.JWT_SECRET) {
  console.error("❌ FATAL: JWT_SECRET environment variable is not set");
  process.exit(1);
}

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Not authorized — missing Bearer token",
      code:    "NO_TOKEN",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token || token === "null" || token === "undefined") {
    return res.status(401).json({
      message: "Not authorized — token is empty",
      code:    "EMPTY_TOKEN",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.id) {
      return res.status(401).json({
        message: "Not authorized — malformed token payload",
        code:    "MALFORMED_TOKEN",
      });
    }

    // Attach user identity — both .id (string) and ._id (string) for compat
    // Both are the same string value; Mongoose auto-converts to ObjectId in queries.
    req.user = {
      id:  decoded.id.toString(),
      _id: decoded.id.toString(),
    };

    next();
  } catch (err) {
    // Distinguish expired from otherwise invalid
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Not authorized — token expired",
        code:    "TOKEN_EXPIRED",
      });
    }
    return res.status(401).json({
      message: "Not authorized — invalid token",
      code:    "INVALID_TOKEN",
    });
  }
};
