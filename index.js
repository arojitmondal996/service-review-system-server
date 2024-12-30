const express = require('express');
const cors = require('cors');
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken')
const app = express();
const port = process.env.PORT || 3000;
// const cookieParser = require('cookie-parser')

const corsOptions = {
    origin: ['http://localhost:5174',],
    credentials: true,
    optionalSuccessStatus: 200,
}

// 1st make middleware 
app.use(cors(corsOptions));
app.use(express.json());
// app.use(cookieParser())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1uswq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// verify token make for verify
const verifyToken = (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).send({ error: "Access denied. No token provided." });
    }

    try {
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        req.user = decoded; // Attach user info to the request object
        next();
    } catch (err) {
        console.error('JWT Verification Error:', err);
        return res.status(403).send({ error: "Invalid or expired token." });
    }
};

async function run() {
    try {

        const serviceCollection = client.db('serviceDB').collection('service');
        const reviewCollection = client.db('serviceDB').collection('reviews');
        const userCollection = client.db('serviceDB').collection('users');

        // Connect the client to the server	(optional starting in v4.7)
        //   await client.connect();

        // generate jsonwebtoken
        app.post('/jwt', async (req, res) => {
            const email = req.body
            // create token
            const token = jwt.sign(email, process.env.SECRET_KEY, { expiresIn: '365d' })
            console.log(token)
            // cookie ta client side ea cookie te store korar jonno use korte hobe nicer instruction
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            })
                .send({ success: true })
        })


        // 0000000000 first data ta client theke eakhane pathate hobe
        app.post('/service', verifyToken, async (req, res) => {
            const newService = req.body;

            if (!newService.serviceTitle || !newService.userEmail) {
                return res.status(400).send({ message: "Service title and user email are required." });
            }

            try {
                const result = await serviceCollection.insertOne(newService);
                res.status(201).send(result);
            } catch (error) {
                console.error('Error adding service:', error);
                res.status(500).send({ message: "Internal Server Error" });
            }
        });

        // to get all service when i click the add to service button then i got it add service page within  this code 

        app.get('/services', async (req, res) => {
            try {
                const services = await serviceCollection.find().limit(6).toArray();
                res.status(200).send(services);
            } catch (error) {
                console.error("Error fetching services:", error);
                res.status(500).send({ message: "Internal Server Error" });
            }
        });

        // when i click the details button then i got details within this api
        app.get('/service/:id', async (req, res) => {
            const { id } = req.params;

            try {
                const service = await serviceCollection.findOne({ _id: new ObjectId(id) });
                if (service) {
                    res.status(200).send(service);
                } else {
                    res.status(404).send({ message: "Service not found." });
                }
            } catch (error) {
                console.error("Error fetching service:", error);
                res.status(500).send({ message: "Internal Server Error" });
            }
        });


        // Add a new review
        app.post('/reviews',  async (req, res) => {
            const newReview = req.body;

            if (!newReview.serviceId || !newReview.userEmail || !newReview.text || !newReview.rating) {
                return res.status(400).send({ message: "Incomplete review data." });
            }

            try {
                const result = await reviewCollection.insertOne({
                    ...newReview,
                    date: new Date().toISOString()
                });
                res.status(201).send(result);
            } catch (error) {
                console.error("Error adding review:", error);
                res.status(500).send({ message: "Internal Server Error" });
            }
        });

        // Get reviews for a specific service
        app.get('/reviews/:serviceId', async (req, res) => {
            const { serviceId } = req.params;

            try {
                const reviews = await reviewCollection.find({ serviceId }).toArray();
                res.status(200).send(reviews);
            } catch (error) {
                console.error("Error fetching reviews:", error);
                res.status(500).send({ message: "Internal Server Error" });
            }
        });


        // Get reviews by logged-in user
        app.get('/user/reviews', async (req, res) => {
            try {
                const userEmail = req.query.email; // Extract email from the decoded token
                const reviews = await reviewCollection.find({ userEmail }).toArray();
                res.status(200).json(reviews);
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: "Failed to fetch reviews." });
            }
        });

        // /////////////////////////////////////////////////

        // Update a service
        app.put('/updateService/:id', async (req, res) => {
            const { id } = req.params;
            const service = req.body;

            try {
                const result = await serviceCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: service }
                );

                if (result.modifiedCount > 0) {
                    res.status(200).send({ message: "Service updated successfully." });
                } else {
                    res.status(404).send({ message: "Service not found." });
                }
            } catch (error) {
                res.status(500).send({ message: "Internal Server Error", error });
            }
        });


        // Delete a service
        app.delete('/service/:id', async (req, res) => {
            const { id } = req.params;

            try {
                const result = await serviceCollection.deleteOne({ _id: new ObjectId(id) });
                console.log(result)
                if (result.deletedCount > 0) {
                    res.status(200).send({ message: "Service deleted successfully." });
                } else {
                    res.status(404).send({ message: "Service not found." });
                }
            } catch (error) {
                res.status(500).send({ message: "Error deleting service", error });
            }
        });

        // //////////////////////////////////////////////////

        // Update a review
        app.put('/updateReview/:id', async (req, res) => {
            const { id } = req.params;
            const review = req.body;

            try {
                const result = await reviewCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: review }
                );

                if (result.modifiedCount > 0) {
                    res.status(200).send({ message: "Service updated successfully." });
                } else {
                    res.status(404).send({ message: "Service not found." });
                }
            } catch (error) {
                res.status(500).send({ message: "Internal Server Error", error });
            }
        });


        // Delete a review
        app.delete('/deleteReview/:id', async (req, res) => {
            const { id } = req.params;

            try {
                const result = await reviewCollection.deleteOne({ _id: new ObjectId(id) });
                console.log(result)
                if (result.deletedCount > 0) {
                    res.status(200).send({ message: "Service deleted successfully." });
                } else {
                    res.status(404).send({ message: "Service not found." });
                }
            } catch (error) {
                res.status(500).send({ message: "Error deleting service", error });
            }
        });

        // //////////////////////////////////////////////////////

        // logout || clear cookie from browser
        app.get('/logout', async (req, res) => {
            res.clearCookie('token', {
                maxAge: 0,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            })
                .send({ success: true })
        })

        // ///////////////////////////////////////////////////////

        // API Route: Get counts for users, reviews, and services
        app.get('/platform-stats', async (req, res) => {
            try {
                // Count documents in each collection
                const servicesCount = await serviceCollection.countDocuments();
                const reviewsCount = await reviewCollection.countDocuments();
                const usersCount = await userCollection.countDocuments(); // Adjust this if your users are stored differently

                // Return aggregated counts
                res.json({
                    users: usersCount,
                    reviews: reviewsCount,
                    services: servicesCount,
                });
            } catch (error) {
                console.error('Error fetching stats:', error);
                res.status(500).json({ message: 'Server error' });
            }
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        //   await client.close();
    }
}
run().catch(console.dir);

// 2nd make a api for running browser
app.get('/', (req, res) => {
    res.send('service Website is running now')
})

// 3rd make port
app.listen(port, () => {
    console.log(`service Server is running on port: ${port}`)
})