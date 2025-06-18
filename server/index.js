const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 9000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 路由挂载
const resumeRoutes = require('./resume/resumeRoutes');
const designReviewRoutes = require('./designreview/designReviewRoutes');
app.use('/', resumeRoutes);
app.use('/', designReviewRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});



