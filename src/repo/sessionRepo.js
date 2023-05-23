module.exports = container => {
  const { schemas } = container.resolve('models')
  const {
    serverHelper,
    tokenTime
  } = container.resolve('config')
  const { Session } = schemas.mongoose
  const createSession = (data) => {
    const n = new Session(data)
    return n.save()
  }
  const getSessionById = (id) => {
    return Session.findById(id)
  }
  const deleteSession = (id) => {
    return Session.findByIdAndRemove(id, { useFindAndModify: false })
  }
  const updateSession = (id, n, opts = {}) => {
    return Session.findByIdAndUpdate(id, n, {
      ...opts,
      useFindAndModify: false,
      returnOriginal: false
    })
  }
  const updateSessionByCondition = (id, n, opts = {}) => {
    return Session.updateOne(id, n, {
      ...opts,
      useFindAndModify: false,
      returnOriginal: false
    })
  }
  const checkIdExist = (id) => {
    return Session.findOne({ id })
  }
  const getCount = (pipe = {}) => {
    return Session.countDocuments(pipe)
  }
  const findOne = (pipe = {}) => {
    return Session.findOne(pipe)
  }
  const getSessionAgg = (pipe) => {
    return Session.aggregate(pipe)
  }
  const getSession = (pipe, limit, skip, sort) => {
    return Session.find(pipe).limit(limit).skip(skip).sort(sort)
  }
  const getSessionNoPaging = (pipe, sort = { _id: -1 }) => {
    return Session.find(pipe).sort(sort)
  }
  const removeSession = (pipe) => {
    return Session.deleteMany(pipe)
  }
  const deleteOne = (pipe) => {
    return Session.deleteOne(pipe)
  }
  return {
    getSessionNoPaging,
    removeSession,
    createSession,
    getSessionAgg,
    getSessionById,
    deleteSession,
    updateSession,
    checkIdExist,
    getCount,
    getSession,
    deleteOne,
    findOne,
    updateSessionByCondition
  }
}
