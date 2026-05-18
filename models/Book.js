import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  coverImage: { type: String, default: '/assets/logo_libon_m.png' },
  rating: { type: Number, default: 0 },
  category: { type: String, required: true },
  barcode: { type: String, required: true, unique: true },
  status: { type: String, enum: ['available', 'borrowed'], default: 'available' },
  borrowedBy: { type: String, default: null }
}, { timestamps: true });

// Convert _id to id for frontend compatibility
bookSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    delete ret._id;
  }
});

const Book = mongoose.model('Book', bookSchema);

export default Book;
