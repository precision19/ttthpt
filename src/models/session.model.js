module.exports = (joi, mongoose) => {
  const sessionSchema = mongoose.Schema({
    createdAt: { type: Number, default: () => Math.floor(Date.now() / 1000) },
    authTime: { type: Number },
    uid: { type: String, index: true },
    deviceId: { type: String, index: true },
    hash: { type: String, index: true },
    expireAt: { type: Number },
    deviceName: { type: String },
    updateAt: { type: Number },
    fcmToken: { type: String }
  })
  return mongoose.model('session', sessionSchema)
}
