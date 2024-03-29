const express = require('express');

const app = express();
const { User } = require('./db');
const cors = require('cors');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
// const data = require('./data');
const { Student, submittedDates } = require('./db');
const { use } = require('./routes/auth');
app.use(express.json());
// const saveStudentsToDatabase = require('./saveStudentsToDatabase');
// saveStudentsToDatabase();
app.use(
  cors({
    credentials: true,
    origin: 'http://localhost:3000',
  })
);
app.use(express.json());
app.use(cookieParser());
mongoose
  .connect('mongodb://0.0.0.0/attendance')
  .then(() => console.log('MongoDB is  connected successfully'))
  .catch((err) => console.error(err));

app.use('/auth', require('./routes/auth'));
app.use('/posts', require('./routes/posts'));
app.get('/', (req, res) => {
  res.send('Hello');
});

//success -- To get the userName
app.get('/api/user/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    res.json(user);
    console.log(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

//success -- Retriving All Datas from Student Model
app.get('/api/students', async (req, res) => {
  try {
    const data = await Student.find(); // Fetch data from MongoDB
    res.json(data); // Send fetched data as a JSON response
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//success -- update attendance
app.post(
  '/api/updateAttendance/:year/:department/:section',
  async (req, res) => {
    try {
      const { presentStudents, absentStudents } = req.body;
      const dep = req.params.department;

      const year = req.params.year;
      const section = req.params.section;
      const department = await Student.findOne({
        department: dep,
      });

      const sectionToLoop = department.students[0][year][0][section];

      const newDate = new Date().toISOString().slice(0, 10);
      const submittedDepartment = await submittedDates.findOne({
        departmentId: dep + section,
      });
      if (!submittedDepartment.dates.includes(newDate)) {
        for (const student of sectionToLoop) {
          const isPresent = presentStudents.some((presentStudent) => {
            return presentStudent._id == student._id;
          });
          if (isPresent) {
            student.presentDates.push(newDate);
            student.presentCount += 1;
          } else {
            student.absentDates.push(newDate);
            student.absentCount += 1;
          }
        }
        await department.save();

        res.status(200).json({ message: 'Attendance updated successfully' });
        await submittedDates.findOneAndUpdate(
          { departmentId: dep + section },
          { $push: { dates: newDate } }
          // { upsert: true }
        );
      }
    } catch (error) {
      console.error('Error updating attendance:', error);
      res.status(500).json({ error: 'Failed to update attendance' });
    }
  }
);

//sucess -- Retriving Submission Status
app.get('/api/submissionstatus/:departmentId', async (req, res) => {
  try {
    const departmentId = req.params.departmentId;
    const newDate = new Date().toISOString().slice(0, 10);

    // Assuming submittedDates is your MongoDB collection
    const submittedDepartment = await submittedDates.findOne({
      departmentId: departmentId, // Use the received departmentId in the query
    });

    if (submittedDepartment && submittedDepartment.dates.includes(newDate)) {
      res.status(200).json({ message: 'true' });
    } else {
      res.status(200).json({ message: 'false' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
    console.error('Error fetching submission status:', error);
  }
});

//success -- Add Student in Edit Page
app.post('/api/:year/:department/:section/addstudents', async (req, res) => {
  try {
    const {
      name,
      year,
      department,
      section,
      departmentId,
      category,
      email,
      username,
      rollNo,
      registerNo,
      mobileNo,
    } = req.body;

    const studDepartment = req.params.department;
    const studYear = req.params.year;
    const studSection = req.params.section;
    const dep = await Student.findOne({
      department: studDepartment,
    });

    const sectionToLoop = dep.students[0][studYear][0][studSection];
    const newStudent = {
      name,
      year,
      department,
      section,
      departmentId,
      rollNo,
      registerNo,
      mobileNo,
      category,
      email,
      username,
    };
    sectionToLoop.push(newStudent);
    await dep.save();

    res.status(201).json({ message: 'Student added successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//success -- Searching in Remove Student Edit Page
app.get(
  '/api/findstudent/:year/:department/:section/:registerno',
  async (req, res) => {
    const regNo = req.params.registerno;
    const department = req.params.department;
    const year = req.params.year;
    const section = req.params.section;
    const dep = await Student.findOne({
      department: department,
    });

    const sectionToLoop = dep.students[0][year][0][section];
    // console.log(sectionToLoop);
    const student = sectionToLoop.filter((item) => item.registerNo == regNo);
    console.log('student: ' + student);
    // const student = await Student.findOne({ registerNo: registerNumber });
    res.status(200).json({ found: student[0] });
  }
);

//success -- Deletion in Edit Page
app.delete(
  '/api/deletestudent/:year/:department/:section/:studentid',
  async (req, res) => {
    const studentIdToDelete = req.params.studentid;
    const department = req.params.department;
    const year = req.params.year;
    const section = req.params.section;

    const filter = {
      department: department,
    };

    try {
      const update = {
        $pull: {
          [`students.0.${year}.0.${section}`]: { _id: studentIdToDelete },
        },
      };

      const result = await Student.findOneAndUpdate(filter, update, {
        new: true,
      });

      if (result) {
        console.log(
          `Student with ID ${studentIdToDelete} deleted successfully.`
        );
        res.status(200).json({ message: `Student deleted successfully.` });
      } else {
        console.log('Student not found or not deleted.');
        res.status(404).json({ message: 'Student not found or not deleted.' });
      }
    } catch (error) {
      console.error('Error deleting student:', error);
      res.status(500).json({ message: 'Internal server error.' });
    }
  }
);

//success -- Retriving class details
app.get('/api/:year/:department/:section/classdetails', async (req, res) => {
  const year = req.params.year;
  const department = req.params.department;
  const section = req.params.section;
  // const departmentId = 'ECEB';
  const models = {
    Student: Student, // Assuming Student is your Mongoose model
    // Add more models if needed
  };

  const modelName = 'Student'; // or any other model name string

  const Model = models[modelName]; // Access the model using the modelName
  const dep = await Model.findOne({ department: department });

  const collegestudents = dep.students[0][year][0][section];
  // console.log('college : ' + collegestudents);
  res.send(collegestudents);
});

app.get('/api/:year/:department/departmentdetails', async (req, res) => {
  const year = req.params.year;
  const department = req.params.department;
  const dep = await Student.findOne({
    department: department,
  });

  const sectionToLoop = dep.students[0][year][0];
  console.log(sectionToLoop);
  res.status(200).json(sectionToLoop);
});

app.get(
  '/api/:year/:department/:section/:email/studentdetails',
  async (req, res) => {
    const year = req.params.year;
    const department = req.params.department;
    const email = req.params.email;
    const section = req.params.section;
    const dep = await Student.findOne({
      department: department,
    });

    const sectionToLoop = dep.students[0][year][0][section];
    const student = sectionToLoop.filter((item) => item.email === email);
    // console.log('hi' + student);
    res.status(200).json(student);
  }
);
app.listen(4000, () => {
  console.log('Server running on 4000');
});

//FAILURE : BUT MAY BE USED LATER
// app.get('/api/collegestudents', async (req, res) => {
//   const year = 'I';
//   const department = 'MECH';
//   const section = 'A';
//   const departmentId = 'ECEB';
//   const models = {
//     Student: Student, // Assuming Student is your Mongoose model
//     // Add more models if needed
//   };

//   const modelName = 'Student'; // or any other model name string

//   const Model = models[modelName]; // Access the model using the modelName
//   const dep = await Model.findOne({ department: department });

//   const collegestudents = dep.students[0][year][0][section][0].name;
//   // console.log('college : ' + collegestudents);
//   res.send(collegestudents);
// });
