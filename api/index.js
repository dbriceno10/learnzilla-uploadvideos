require("dotenv").config();
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const { google } = require("googleapis");
const app = express();

const cors = require('cors');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const morgan = require('morgan');

app.name = 'API';

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(cookieParser());
app.use(morgan('dev'));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  );
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.header('Access-Control-Expose-Headers', 'Content-Range');
  res.header('Content-Range', 'bytes:0-9/100');
  next();
});
var fileID;
var dataUrl;

const { CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN, REDIRECT_URI } = process.env;

const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const drive = google.drive({
  version: "v3",
  auth: oAuth2Client,
});

var authed = true; //*this was on false

//multer is use to upload a image
var Storage = multer.diskStorage({
  destination: function (req, file, callback) {
    fs.mkdirSync("./images", { recursive: true });
    callback(null, "./images");
  },
  filename: function (req, file, callback) {
    callback(null, file.fieldname + "_" + Date.now() + "_" + file.originalname);
  },
});

var upload = multer({
  storage: Storage,
}).single("file"); //Field name and max count

// async function response(fileMetadata, media) {
//   let answer = await drive.files.create({
//     resource: fileMetadata,
//     media: media,
//     fields: "id",
//   });
//   console.log("answer", answer);
//   return answer;
// }

app.post("/upload", async (req, res) => {
  upload(req, res, function (err) {
    if (err) {
      console.log(err);
      return res.end("Something went wrong");
    } else {
      var arrayData = [];
      console.log("path of file:", req.file.path);
      const fileMetadata = {
        name: req.file.filename,
      };
      const media = {
        mimeType: req.file.mimetype,
        body: fs.createReadStream(req.file.path),
      };
      drive.files.create(
        {
          resource: fileMetadata,
          media: media,
          fields: "id",
        },
        (err, file) => {
          if (err) {
            // Handle error
            console.error(err);
            return res.status(404).send(err);
          } else {
            fileID = file.data.id;
            // console.log('File=: ', file)
            console.log("file id: ", fileID);
            fs.unlinkSync(req.file.path);
            const url = generatePublicUrl(fileID);
            url.then((data) => {
              console.log("data: ", data);
              return res.send(data);
            }).catch((err) => {
              console.log("err: ", err);
              return res.status(404).send(err);
            });
          }
        }
      );
      // res.send({message: "Se ha creado el video"});
    }
  });
});

async function generatePublicUrl(fileID) {
  try {
    console.log("generate file id: ", fileID);
    await drive.permissions.create({
      fileId: fileID,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });
    const result = await drive.files.get({
      fileId: fileID,
      fields: "webViewLink, webContentLink",
    });

    dataUrl = result.data;
    return result.data;
  } catch (err) {
    console.error(err);
  }
}

// async function deleteFile(fileID) {
//   try {
//     const response = await drive.files.delete({
//       fileId: fileID,
//     });
//   } catch (err) {
//     console.error(err);
//   }
// }

app.get("/info", (req, res) => {
  res.send(dataUrl);
});

app.listen(5000, () => {
  console.log("App is listening on Port 5000");
});
