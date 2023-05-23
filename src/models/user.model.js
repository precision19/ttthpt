module.exports = (joi, mongoose) => {
  const userSchema = mongoose.Schema({
    username: { type: String, lowercase: true, trim: true, index: true },
    createdAt: { type: Number, default: () => Math.floor(Date.now() / 1000) },
    email: { type: String, index: true },
    avatar: { type: String },
    uid: { type: String, trim: true, unique: true, index: true },
    name: { type: String },
    isLocked: { type: Number, default: 0 },
    fcmToken: { type: String },
    phoneNumber: { type: String },
    provider: { type: String },
    about: { type: String, allow: '' },
  })
  return mongoose.model('user', userSchema)
}
