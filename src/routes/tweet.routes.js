import { createTweet, getUserTweets, updateTweet, deleteTweet } from "../controllers/tweet.controllers.js"
import { verifyJWT, optionalVerifyJWT } from "../middlewares/auth.middleware.js";
import { Router } from "express";

const router = Router()

//unsecured 

router.route("/t/:userId").get(optionalVerifyJWT, getUserTweets)

//secured

router.use(verifyJWT)

router.route("/t/").post(createTweet)

router.route("/t/:tweetId").patch(updateTweet)

router.route("/t/:tweetId").delete(deleteTweet)


export default router