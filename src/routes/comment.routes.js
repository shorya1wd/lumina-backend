import { createComment, updateComment, deleteComment, getVideoComments } from "../controllers/comment.controllers.js"
import { Router } from "express"
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

//unsecured

router.route("/c/:videoId").get(getVideoComments)

//secured

router.use(verifyJWT)

router.route("/c/:videoId").post(createComment)

router.route("/c/:commentId").patch(updateComment).delete(deleteComment)


export default router