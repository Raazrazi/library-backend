import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Book from './models/Book.js';
import History from './models/History.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI;
let useInMemory = false;

// Dummy books for in-memory fallback
let memoryBooks = [
  { id: '1', title: 'Neon Horizons', author: 'J.A. Sterling', coverImage: '/assets/book_cover_scifi.png', rating: 4.8, category: 'Sci-Fi', barcode: '1000000001', status: 'available', borrowedBy: null },
  { id: '2', title: 'Whispers of the Aether', author: 'Elena Vance', coverImage: '/assets/book_cover_fantasy.png', rating: 4.9, category: 'Fantasy', barcode: '1000000002', status: 'borrowed', borrowedBy: 'Alice Johnson' },
  { id: '3', title: 'Midnight Shadows', author: 'Marcus Black', coverImage: '/assets/book_cover_thriller.png', rating: 4.6, category: 'Thriller', barcode: '1000000003', status: 'available', borrowedBy: null },
  { id: '4', title: 'Echoes of Summer', author: 'Lily Rose', coverImage: '/assets/book_cover_romance.png', rating: 4.7, category: 'Romance', barcode: '1000000004', status: 'available', borrowedBy: null }
];

// Dummy history logs for in-memory fallback
let memoryHistory = [
  { 
    id: 'h1', 
    bookId: '2', 
    bookTitle: 'Whispers of the Aether', 
    bookCover: '/assets/book_cover_fantasy.png', 
    bookCategory: 'Fantasy', 
    bookBarcode: '1000000002', 
    studentName: 'Alice Johnson', 
    borrowDate: new Date(Date.now() - 1000 * 60 * 15), // 15 mins ago
    returnDate: null, 
    duration: 0 
  }
];

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB. Using Database Mode.'))
  .catch(err => {
    console.error(err);
    console.warn('\n⚠️ MongoDB connection failed. Falling back to IN-MEMORY mode.\n');
    useInMemory = true;
  });

// --- API: BOOKS LIST ---
app.get('/api/books', async (req, res) => {
  if (useInMemory) return res.json(memoryBooks);
  try {
    const books = await Book.find();
    res.json(books);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- API: ADD BOOK ---
app.post('/api/books', async (req, res) => {
  if (useInMemory) {
    const newBook = { ...req.body, id: Date.now().toString(), status: 'available', borrowedBy: null };
    memoryBooks.push(newBook);
    return res.status(201).json(newBook);
  }
  try {
    const book = new Book(req.body);
    await book.save();
    res.status(201).json(book);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// --- API: BORROW BOOK (Checkout) ---
app.put('/api/books/:id/borrow', async (req, res) => {
  const { studentName } = req.body;
  
  if (useInMemory) {
    const bookIndex = memoryBooks.findIndex(b => b.id === req.params.id);
    if (bookIndex === -1) return res.status(404).json({ message: 'Book not found' });
    
    memoryBooks[bookIndex] = { ...memoryBooks[bookIndex], status: 'borrowed', borrowedBy: studentName };
    const book = memoryBooks[bookIndex];

    // Log the transaction
    const newLog = {
      id: Date.now().toString(),
      bookId: book.id,
      bookTitle: book.title,
      bookCover: book.coverImage,
      bookCategory: book.category,
      bookBarcode: book.barcode,
      studentName,
      borrowDate: new Date(),
      returnDate: null,
      duration: 0
    };
    memoryHistory.unshift(newLog);

    return res.json(book);
  }

  try {
    const book = await Book.findByIdAndUpdate(
      req.params.id, 
      { status: 'borrowed', borrowedBy: studentName },
      { new: true }
    );
    if (!book) return res.status(404).json({ message: 'Book not found' });

    // Save transaction log
    const historyEntry = new History({
      bookId: book.id,
      bookTitle: book.title,
      bookCover: book.coverImage,
      bookCategory: book.category,
      bookBarcode: book.barcode,
      studentName,
      borrowDate: new Date(),
      returnDate: null,
      duration: 0
    });
    await historyEntry.save();

    res.json(book);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// --- API: RETURN BOOK (Check-in) ---
app.put('/api/books/:id/return', async (req, res) => {
  if (useInMemory) {
    const bookIndex = memoryBooks.findIndex(b => b.id === req.params.id);
    if (bookIndex === -1) return res.status(404).json({ message: 'Book not found' });
    
    const book = memoryBooks[bookIndex];
    memoryBooks[bookIndex] = { ...memoryBooks[bookIndex], status: 'available', borrowedBy: null };

    // Update history log
    const logIndex = memoryHistory.findIndex(h => h.bookId === book.id && h.returnDate === null);
    if (logIndex !== -1) {
      const returnDate = new Date();
      const borrowDate = new Date(memoryHistory[logIndex].borrowDate);
      const duration = Math.round((returnDate.getTime() - borrowDate.getTime()) / 1000); // duration in seconds
      memoryHistory[logIndex] = {
        ...memoryHistory[logIndex],
        returnDate,
        duration
      };
    }

    return res.json(memoryBooks[bookIndex]);
  }

  try {
    const book = await Book.findByIdAndUpdate(
      req.params.id, 
      { status: 'available', borrowedBy: null },
      { new: true }
    );
    if (!book) return res.status(404).json({ message: 'Book not found' });

    // Update active history log
    const activeLog = await History.findOne({ bookId: book.id, returnDate: null });
    if (activeLog) {
      const returnDate = new Date();
      const borrowDate = activeLog.borrowDate;
      const duration = Math.round((returnDate.getTime() - borrowDate.getTime()) / 1000); // duration in seconds
      
      activeLog.returnDate = returnDate;
      activeLog.duration = duration;
      await activeLog.save();
    }

    res.json(book);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// --- API: DELETE BOOK ---
app.delete('/api/books/:id', async (req, res) => {
  if (useInMemory) {
    const bookIndex = memoryBooks.findIndex(b => b.id === req.params.id);
    if (bookIndex === -1) return res.status(404).json({ message: 'Book not found' });
    
    if (memoryBooks[bookIndex].status === 'borrowed') {
      return res.status(400).json({ message: 'Cannot delete a book that is currently borrowed.' });
    }
    
    memoryBooks.splice(bookIndex, 1);
    return res.json({ message: 'Book deleted successfully' });
  }

  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    
    if (book.status === 'borrowed') {
      return res.status(400).json({ message: 'Cannot delete a book that is currently borrowed.' });
    }
    
    await Book.findByIdAndDelete(req.params.id);
    res.json({ message: 'Book deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- API: HISTORY LOGS ---
app.get('/api/history', async (req, res) => {
  if (useInMemory) return res.json(memoryHistory);
  try {
    const history = await History.find().sort({ createdAt: -1 });
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// --- API: HISTORY LOGS ---
app.get('/api/history', async (req, res) => {
  // ... your existing code ...
});

// CHANGE THIS PART:
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}