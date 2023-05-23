const repo = (container) => {
  const sessionRepo = require('./sessionRepo')(container)
  const userRepo = require('./userRepo')(container)
  return { sessionRepo, userRepo }
}
const connect = (container) => {
  const dbPool = container.resolve('db')
  if (!dbPool) throw new Error('Connect DB failed')
  return repo(container)
}

module.exports = { connect }
