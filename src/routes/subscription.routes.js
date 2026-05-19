import { verifyJWT } from "../middlewares/auth.middleware.js";
import { Router } from "express";
import {getUserChannelSubscribers,getSubscribedChannels,toggleSubscription} from "../controllers/subscription.controllers.js"

const router=Router()

//unsecured routes

//

// secured routes

router.use(verifyJWT)

router.route("/s/:channelId").post(toggleSubscription).get(getUserChannelSubscribers)

router.route("/s/").get(getSubscribedChannels)

export default router
