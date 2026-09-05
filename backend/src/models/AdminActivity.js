import mongoose from 'mongoose';

const { Schema } = mongoose;

/** Audit trail for administrative content changes. */
const adminActivitySchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actorName: { type: String, default: '' },
    action: { type: String, required: true, index: true }, // create | update | delete | publish | import
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, default: '' },
    summary: { type: String, default: '' },
    changes: { type: Schema.Types.Mixed, default: null },
    ip: { type: String, default: '' },
  },
  { timestamps: true },
);

adminActivitySchema.index({ createdAt: -1 });

export const AdminActivity = mongoose.model('AdminActivity', adminActivitySchema);
export default AdminActivity;
