
const generateRandomString = function () {
  let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let randomNumbers = [];
  let randomString = '';
  for (let i = 0; i <= 5; i++) {
    let randomNumber = Math.floor(Math.random() * 61);
    randomNumbers.push(randomNumber);
  }
  for (let number of randomNumbers) {
    randomString += characters[number];
  }
  return randomString;
}

const urlsForUser = function (data) {
  let URLS = {};
  for (let object of data) {
   let shortUrl = object.shorturl;
   URLS[shortUrl] = object.longurl
  }
  return URLS;
};

module.exports = { generateRandomString, urlsForUser };

