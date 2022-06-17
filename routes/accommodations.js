const express = require("express");
const authMiddleware = require("../middlewares/auth-middleware");
const User = require("../models/user");
const Accommodation = require("../models/accommodation");
const Images = require("../models/image");
const Counters = require("../models/counter");
const router = express.Router();

const aws = require("aws-sdk");
const accommodation = require("../models/accommodation");
const s3 = new aws.S3();
aws.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: "ap-northeast-2",
});


//<-----전체 숙소 리스트 조회 API----->
router.get("/", async (req, res) => {
  //숙소들을 모두 보여준다.
  const accommodations = await Accommodation.find().exec();
  res.json({
    accommodations,
  });
});


//<-----기간으로 검색  API----->
router.get("/searchByPeriod", async (req, res) => {  
  const { tripStart, tripEnd } = req.body;
  const targetAccommodations = await Accommodation.find({
    $and : 
    [
    { "openAt": { $lte : tripStart } },
    { "closeAt": { $gte : tripEnd } }
    ]
  });
  res.json({
    targetAccommodations,
  });
});


//<-----숙소정보 상세 조회 API----->
router.get("/:accId", async (req, res) => {
  const { accId } = req.params;
  const accommodation = await Accommodation.findOne({ accId });
  res.json({
    accommodation,
  });
});


//<-----숙소 정보 작성 API----->
router.post("/", authMiddleware, async (req, res) => {
  //작성자의 userId를 숙소 정보와 함께 DB에 저장
  const userId = res.locals.user.userId;
  const {    
    photos,
    accName,
    openAt,
    closeAt,
    address,
    desc1_hanmadi,
    desc2_surroundings,
    desc3_notice,
    desc4_basics,
    facilities,
    charge,
  } = req.body;

  //accId를 자동으로 생성하며, 1씩 증가하게 카운팅해준다.
  let counter = await Counters.findOne({ name: "Accommodation" }).exec();
  if (!counter) {
    counter = await Counters.create({ name: "Accommodation", count: 0 });
  }
  counter.count++;
  counter.save();
  let accId = counter.count;

  if (
    !photos ||
    !accName ||
    !openAt ||
    !closeAt ||
    !address ||
    !desc1_hanmadi ||
    !desc2_surroundings ||
    !desc3_notice ||
    !desc4_basics ||
    !facilities ||
    !charge
  ) {
    return res.status(400).json({
      errorMessage: "작성란을 모두 입력해주세요.",
    });
  }

  await Accommodation.create({
    accId,
    userId,
    photos,
    accName,
    openAt,
    closeAt,
    address,
    desc1_hanmadi,
    desc2_surroundings,
    desc3_notice,
    desc4_basics,
    facilities,
    charge,
  });

  res.status(200).json({ message: "숙소 정보를 등록했습니다." });
});


//<----숙소정보 수정 API----->
router.put("/:accId", authMiddleware, async (req, res) => {
  const { accId } = req.params;
  const userId = res.locals.user.userId; 
  const {    
    photos,
    accName,
    openAt,
    closeAt,
    address,
    desc1_hanmadi,
    desc2_surroundings,
    desc3_notice,
    desc4_basics,
    facilities,
    charge,
  } = req.body;

  const existAccommodation = await Accommodation.findOne({ accId });

  if (
    !photos ||
    !accName ||
    !openAt ||
    !closeAt ||
    !address ||
    !desc1_hanmadi ||
    !desc2_surroundings ||
    !desc3_notice ||
    !desc4_basics ||
    !facilities ||
    !charge
  ) {
    return res.status(400).json({
      errorMessage: "작성란을 모두 입력해주세요.",
    });
  }

  // 수정글을 작성하면서 사진 이미지도 새로 올렸다면(= imageUrl 값이 바뀌었다면)
  // 해당 게시글과 함께 S3에 올렸던 이미지 파일도 삭제
  // .split은 bucket 내의 경로를 생성하기 위함.
  // Images DB 에서도 정보 삭제

  // if (existArticles.imageUrl === imageUrl) {

  //   s3.deleteObject({
  //     Bucket : 'hh99-6th',
  //     Key : existArticles.imageUrl.split(".com/",2)[1]
  //   }, function(err, data){});

  //   await Images.deleteOne({
  //     imageUrl : existArticles.imageUrl
  //   })
  // }

  if (userId === existAccommodation["userId"]) {
    //현재 로그인한 사용자가 숙소를 등록한 사용자라면 숙소 정보 수정을 실행한다.
    await Accommodation.updateOne(
      { accId },
      {
        $set: {
          accId,
          userId,
          photos,
          accName,
          openAt,
          closeAt,
          address,
          desc1_hanmadi,
          desc2_surroundings,
          desc3_notice,
          desc4_basics,
          facilities,
          charge,
        },
      }
    );
    res
      .status(200)
      .json({ message: "숙소 정보를 수정했습니다." });
  } else {
    return res
      .status(400)
      .json({ errorMessage: "등록자만 수정할 수 있습니다." });
  }
});


//<-----숙소 정보 삭제 API----->
router.delete("/:accId", authMiddleware, async (req, res) => {
  const { accId } = req.params;
  const userId = res.locals.user.userId; 
  const existAccommodation = await Accommodation.findOne({ accId });
  
  if (userId === existAccommodation["userId"]) {
    await Accommodation.deleteOne({ accId });

    // 해당 게시글과 함께 S3에 올렸던 이미지 파일도 삭제
    // .split은 bucket 내의 경로를 생성하기 위함.
    // s3.deleteObject(
    //   {
    //     Bucket: "hh99-6th",
    //     Key: article.imageUrl.split(".com/", 2)[1],
    //   },
    //   function (err, data) {}
    // );

    // Images DB 에서도 정보 삭제
    // await Images.deleteOne({
    //   imageUrl: article.imageUrl,
    // });

    res.status(200).json({
      message: "숙소 정보를 삭제했습니다.",
    });
  } else {
    return res.status(400).send({
      errorMessage: "등록자만 삭제할 수 있습니다.",
    });
  }
});

module.exports = router;
