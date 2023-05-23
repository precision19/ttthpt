module.exports = (container) => {
  const userController = require('./userController')(container)
  return { userController }
}
