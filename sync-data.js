// sync-data.js - Tự động tải dữ liệu gốc từ GitHub alpha123/uma-skill-tools
const https = require('https');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// Các file dữ liệu cốt lõi từ kho lưu trữ của alpha123
const FILES_TO_SYNC = [
  {
    name: 'course_data.json',
    url: 'https://raw.githubusercontent.com/alpha123/uma-skill-tools/master/data/course_data.json'
  },
  {
    name: 'skill_data.json',
    url: 'https://raw.githubusercontent.com/alpha123/uma-skill-tools/master/data/skill_data.json'
  },
  {
    name: 'skillnames.json',
    url: 'https://raw.githubusercontent.com/alpha123/uma-skill-tools/master/data/skillnames.json'
  }
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP Status ${res.statusCode} khi tải ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

(async () => {
  console.log('Đang tải dữ liệu từ GitHub alpha123/uma-skill-tools...');
  for (const item of FILES_TO_SYNC) {
    try {
      const destPath = path.join(DATA_DIR, item.name);
      await downloadFile(item.url, destPath);
      console.log(`✔ Đã tải xong: data/${item.name}`);
    } catch (e) {
      console.log(`⚠ Không thể tải ${item.name}: ${e.message}`);
    }
  }
  console.log('Hoàn tất đồng bộ dữ liệu!');
})();