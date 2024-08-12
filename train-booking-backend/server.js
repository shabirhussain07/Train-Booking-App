const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcryptjs"); // For hashing passwords

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

//! MySQL connection
const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Root@1234",
  database: "train_booking_app",
});

// Connect to MySQL
connection.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err);
    return;
  }
  console.log("Connected to MySQL database!");
});

// Root route
app.get("/", (req, res) => {
  res.send("Welcome to the Train Booking API!");
});

// API endpoint to fetch train details
app.get("/api/trains", (req, res) => {
  const {
    source,
    destination,
    date,
    component,
    page = 1,
    limit = 1000,
  } = req.query; // Default limit to 10
  const offset = (page - 1) * limit; // Calculate offset for pagination

  // If the request is for the TrainDetails component, fetch random trains
  if (component === "TrainDetails") {
    const query =
      'SELECT *, JSON_EXTRACT(coach_classes, "$") AS coach_classes, JSON_EXTRACT(price_per_class, "$") AS price_per_class FROM trains ORDER BY RAND() LIMIT ?';
    connection.query(query, [limit], (err, results) => {
      if (err) {
        console.error("Error fetching train data:", err);
        return res.status(500).json({ error: "Database error" });
      }
      res.json(results);
    });
  } else {
    // For other components, use pagination
    if (source && destination && date) {
      const query =
        "SELECT * FROM trains WHERE source = ? AND destination = ? AND DATE(departure_time) = ? LIMIT ? OFFSET ?";
      connection.query(
        query,
        [source, destination, date, limit, offset],
        (err, results) => {
          if (err) {
            console.error("Error fetching train data:", err);
            return res.status(500).json({ error: "Database error" });
          }
          console.log("API response:", results); // Log the results
          res.json(results);
        }
      );
    } else {
      const query =
        'SELECT *, JSON_EXTRACT(coach_classes, "$") AS coach_classes, JSON_EXTRACT(price_per_class, "$") AS price_per_class FROM trains LIMIT ? OFFSET ?';
      connection.query(query, [limit, offset], (err, results) => {
        if (err) {
          console.error("Error fetching train data:", err);
          return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
      });
    }
  }
});

// API endpoint for user signup
app.post("/api/signup", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    const query = "INSERT INTO users (name, email, password) VALUES (?, ?, ?)";
    connection.query(query, [name, email, hashedPassword], (err, results) => {
      if (err) {
        return res.status(500).json({ error: "Error creating user." });
      }
      res.status(201).json({ message: "User created successfully." });
    });
  } catch (error) {
    res.status(500).json({ error: "Error signing up." });
  }
});

// API endpoint for user login
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  const query = "SELECT * FROM users WHERE email = ?";
  connection.query(query, [email], async (err, results) => {
    if (err || results.length === 0) {
      return res.status(401).json({ error: "Wrong email or password." });
    }

    const user = results[0];

    // Compare the password with the hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Wrong email or password." });
    }

    // Return the user's details
    res.status(200).json({
      user: {
        name: user.name,
        email: user.email,
        age: user.age,
        dob: user.dob,
        mobile_number: user.mobile_number,
        country: user.country,
        gender: user.gender,
      },
    });
  });
});

// API endpoint to fetch user profile
app.get("/api/profile", (req, res) => {
  const email = req.query.email; // Get email from query parameters

  const query = "SELECT * FROM users WHERE email = ?";
  connection.query(query, [email], (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    const user = results[0];
    res.json(user);
  });
});

// API endpoint to update user profile
app.put("/api/profile", (req, res) => {
  const email = req.body.email; // Get email from request body
  const { name, age, dob, mobile_number, country, gender } = req.body;

  const query =
    "UPDATE users SET name = ?, age = ?, dob = ?, mobile_number = ?, country = ?, gender = ? WHERE email = ?";
  connection.query(
    query,
    [name, age, dob, mobile_number, country, gender, email],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: "Error updating profile." });
      }

      res.json({ message: "Profile updated successfully." });
    }
  );
});

// API endpoint to fetch station suggestions
app.get("/api/stations", (req, res) => {
  const query = req.query.query;

  if (!query) {
    return res.status(400).json({ error: "Query parameter is required." });
  }

  const stationQuery = "SELECT DISTINCT source, destination FROM trains";
  connection.query(stationQuery, (err, results) => {
    if (err) {
      console.error("Error fetching station data:", err);
      return res.status(500).json({ error: "Database error" });
    }

    const stations = new Set();
    results.forEach((row) => {
      stations.add(row.source.toLowerCase());
      stations.add(row.destination.toLowerCase());
    });

    const filteredStations = Array.from(stations).filter((station) =>
      station.includes(query.toLowerCase())
    );
    res.json(filteredStations);
  });
});

// API endpoint to create a booking
app.post("/api/bookings", (req, res) => {
  const {
    user_id,
    train_id,
    seat_number,
    user_name,
    user_age,
    user_gender,
    train_number,
    train_name,
    source,
    destination,
    class: coachClass,
    departure_time,
    arrival_time,
    price,
    email,
  } = req.body;

  // Format departure_time and arrival_time to MySQL compatible format
  const formattedDepartureTime = new Date(departure_time)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
  const formattedArrivalTime = new Date(arrival_time)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  const query = `
    INSERT INTO bookings (
      user_id, 
      train_id, 
      seat_number, 
      user_name, 
      user_age, 
      user_gender, 
      train_number, 
      train_name, 
      source, 
      destination, 
      class, 
      departure_time, 
      arrival_time, 
      price, 
      email
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  connection.query(
    query,
    [
      user_id,
      train_id,
      seat_number,
      user_name,
      user_age,
      user_gender,
      train_number,
      train_name,
      source,
      destination,
      coachClass,
      formattedDepartureTime, // Use formatted departure time
      formattedArrivalTime, // Use formatted arrival time
      price,
      email,
    ],
    (err, results) => {
      if (err) {
        console.error("Error creating booking:", err);
        return res.status(500).json({ error: "Error creating booking." });
      }

      // Check if user_id is provided
      if (user_id) {
        res.status(201).json({
          message: "Booking created successfully.",
          bookingId: results.insertId,
        });
      } else {
        // Handle the case where user_id is not provided
        res.status(400).json({ error: "User ID is required." });
      }
    }
  );
});

// API endpoint to fetch bookings for a specific user
app.get("/api/bookings", (req, res) => {
  const email = req.query.email; // Get email from query parameters

  // Adjust the query to exclude the status column
  const query = `
    SELECT user_id, train_id, seat_number, user_name, user_age, user_gender,
           train_number, train_name, source, destination, class, 
           departure_time, arrival_time, price, email 
    FROM bookings WHERE email = ?`;

  connection.query(query, [email], (err, results) => {
    if (err) {
      console.error("Error fetching bookings:", err);
      return res.status(500).json({ error: "Database error" });
    }

    res.json(results);
  });
});

// API endpoint to delete a booking by train_id
app.delete("/api/bookings/train/:trainId", (req, res) => {
  const trainId = req.params.trainId;

  const query = "DELETE FROM bookings WHERE train_id = ?";
  connection.query(query, [trainId], (err, results) => {
    if (err) {
      console.error("Error deleting booking:", err);
      return res.status(500).json({ error: "Error deleting booking." });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Booking not found." });
    }
    res.status(204).send(); // No content response for successful deletion
  });
});

// API endpoint to create a review
app.post("/api/reviews", (req, res) => {
  const { user_id, train_id, ratings, comments, train_name } = req.body;

  // Validate ratings
  if (ratings < 1 || ratings > 5) {
    return res.status(400).json({ error: "Ratings must be between 1 and 5." });
  }

  // Validate train_name
  if (!train_name) {
    return res.status(400).json({ error: "Train name is required." });
  }

  const query =
    "INSERT INTO reviews (user_id, train_id, ratings, comments, train_name, upvotes, downvotes, report_count) VALUES (?, ?, ?, ?, ?, 0, 0, 0)";
  connection.query(
    query,
    [user_id, train_id, ratings, comments, train_name],
    (err, results) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(400).json({
            error: "You have already submitted a review for this train.",
          });
        }
        console.error("Error creating review:", err);
        return res.status(500).json({ error: "Error creating review." });
      }
      res.status(201).json({ message: "Review created successfully." });
    }
  );
});

// API endpoint to delete a review
app.delete("/api/reviews/:id", (req, res) => {
  const reviewId = req.params.id;
  const userId = req.body.user_id; // Get user_id from request body to verify ownership

  const query = "DELETE FROM reviews WHERE id = ? AND user_id = ?";
  connection.query(query, [reviewId, userId], (err, results) => {
    if (err) {
      console.error("Error deleting review:", err);
      return res.status(500).json({ error: "Error deleting review." });
    }
    if (results.affectedRows === 0) {
      return res.status(403).json({ error: "You cannot delete this review." });
    }
    res.json({ message: "Review deleted successfully." });
  });
});

// API endpoint to upvote a review
app.post("/api/reviews/:id/upvote", (req, res) => {
  const reviewId = req.params.id;

  const query = "UPDATE reviews SET upvotes = upvotes + 1 WHERE id = ?";
  connection.query(query, [reviewId], (err, results) => {
    if (err) {
      console.error("Error upvoting review:", err);
      return res.status(500).json({ error: "Error upvoting review." });
    }
    res.json({ message: "Review upvoted successfully." });
  });
});

// API endpoint to downvote a review
app.post("/api/reviews/:id/downvote", (req, res) => {
  const reviewId = req.params.id;

  const query = "UPDATE reviews SET downvotes = downvotes + 1 WHERE id = ?";
  connection.query(query, [reviewId], (err, results) => {
    if (err) {
      console.error("Error downvoting review:", err);
      return res.status(500).json({ error: "Error downvoting review." });
    }
    res.json({ message: "Review downvoted successfully." });
  });
});

// API endpoint to report a review
app.post("/api/reviews/:id/report", (req, res) => {
  const reviewId = req.params.id;

  const query =
    "UPDATE reviews SET report_count = report_count + 1 WHERE id = ?";
  connection.query(query, [reviewId], (err, results) => {
    if (err) {
      console.error("Error reporting review:", err);
      return res.status(500).json({ error: "Error reporting review." });
    }
    res.json({ message: "Review reported successfully." });
  });
});

// API endpoint to fetch reviews
app.get("/api/reviews", (req, res) => {
  const query =
    "SELECT r.*, u.name AS user_name, u.email AS user_email FROM reviews r JOIN users u ON r.user_id = u.id";
  connection.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching reviews:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
