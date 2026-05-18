import mongoose from 'mongoose';

const historySchema = new mongoose.Schema({
  bookId: { type: String, required: true },
  bookTitle: { type: String, required: true },
  bookCover: { type: String, required: true },
  bookCategory: { type: String, required: true },
  bookBarcode: { type: String, required: true },
  studentName: { type: String, required: true },
  borrowDate: { type: Date, default: Date.now },
  returnDate: { type: Date, default: null },
  duration: { type: Number, default: 0 } // calculated in seconds
}, { timestamps: true });

// Convert _id to id for frontend compatibility
historySchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    delete ret._id;
  }
});

const History = mongoose.model('History', historySchema);

export default History;
