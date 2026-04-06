const mongoose = require('mongoose');
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.log('No MONGODB_URI');
  process.exit(1);
}
mongoose.connect(MONGODB_URI).then(async () => {
  const Exam = mongoose.model('Exam', new mongoose.Schema({ id: String, name: String, date: String }));
  const exams = await Exam.find({});
  const nameMap = {};
  exams.forEach(exam => {
    if (!nameMap[exam.name]) nameMap[exam.name] = [];
    nameMap[exam.name].push(exam);
  });
  for (const name in nameMap) {
    if (nameMap[name].length > 1) {
      console.log('重复考试:', name);
      nameMap[name].forEach(exam => console.log('  ', exam.id, exam.name));
    }
  }
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});