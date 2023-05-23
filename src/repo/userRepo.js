module.exports = container => {
  const { schemas } = container.resolve('models')
  const { User } = schemas.mongoose
  const createUser = (data) => {
    const n = new User(data)
    return n.save()
  }
  const getUserById = (id) => {
    return User.findById(id)
  }
  const findOne = (pipe) => {
    return User.findOne(pipe)
  }
  const findOneAndUpdate = (pipe, update) => {
    return User.findOneAndUpdate(pipe, update, { useFindAndModify: false })
  }
  const deleteUser = (id) => {
    return User.findByIdAndRemove(id, { useFindAndModify: false })
  }
  const updateUser = (id, n) => {
    return User.findByIdAndUpdate(id, n, {
      useFindAndModify: false,
      returnOriginal: false
    })
  }
  const checkIdExist = (id) => {
    return User.findOne({ id })
  }
  const getCount = (pipe = {}) => {
    return User.countDocuments(pipe)
  }
  const getUserAgg = (pipe) => {
    return User.aggregate(pipe)
  }
  const getUsers = (pipe, limit, skip, sort) => {
    return User.find(pipe).limit(limit).skip(skip).sort(sort)
  }
  const getUserNoPaging = (pipe) => {
    return User.find(pipe)
  }
  const removeUser = (pipe) => {
    return User.deleteMany(pipe)
  }
  const getListUserByIds = async (ids) => {
    return await User.find({ uid: { $in: ids } }).select({ password: 0 })
  }
  const updateUserByUid = (pipe, n) => {
    return User.findOneAndUpdate(pipe, n, {
      useFindAndModify: false,
      returnOriginal: false
    })
  }
  return {
    getUserNoPaging,
    removeUser,
    createUser,
    getUserAgg,
    getUserById,
    deleteUser,
    updateUser,
    checkIdExist,
    getCount,
    getUsers,
    findOne,
    findOneAndUpdate,
    getListUserByIds,
    updateUserByUid
  }
}
