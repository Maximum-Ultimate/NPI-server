const express = require('express');
const knex = require('knex')(require('./knexfile').development);
const path = require('path');
const nodemailer = require('nodemailer');
const {
  v4: uuidv4
} = require('uuid');
const QRCode = require('qrcode');
const say = require('say');
const xlsx = require('xlsx');
const multer = require('multer');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
const app = express();
app.use(express.json());
app.use(cors());


const server = http.createServer(app);
const wss = new WebSocket.Server({
  server
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({
  storage
});
wss.on('connection', (ws) => {
  console.log('New WebSocket client connected');

  ws.on('message', async (message) => {
    const data = JSON.parse(message);

    switch (data.action) {
      case 'ADD_COUNTER':
        try {
          const newCounter = await knex('counters').insert({
            counter_name: data.counter_name,
            queues_number: data.queues_number || 0,
            status: data.status || 'inactive',
            remarks: data.remarks || '',
          });
          ws.send(JSON.stringify({
            message: 'Counter added successfully',
            id: newCounter[0]
          }));
        } catch (error) {
          ws.send(JSON.stringify({
            error: 'Error adding counter'
          }));
        }
        break;

      case 'EDIT_COUNTER':
        try {
          await knex('counters').where({
            id: data.id
          }).update({
            counter_name: data.counter_name,
            queues_number: data.queues_number,
            status: data.status,
            remarks: data.remarks,
            updated_at: knex.fn.now(),
          });
          ws.send(JSON.stringify({
            message: 'Counter edited successfully'
          }));
        } catch (error) {
          ws.send(JSON.stringify({
            error: 'Error editing counter'
          }));
        }
        break;

      case 'DELETE_COUNTER':
        try {
          await knex('counters').where({
            id: data.id
          }).del();
          ws.send(JSON.stringify({
            message: 'Counter deleted successfully'
          }));
        } catch (error) {
          ws.send(JSON.stringify({
            error: 'Error deleting counter'
          }));
        }
        break;

      case 'CHANGE_STATUS':
        try {
          await knex('counters').where({
            id: data.id
          }).update({
            status: data.status,
            updated_at: knex.fn.now(),
          });
          ws.send(JSON.stringify({
            message: 'Status changed successfully'
          }));
        } catch (error) {
          ws.send(JSON.stringify({
            error: 'Error changing status'
          }));
        }
        break;

      default:
        ws.send(JSON.stringify({
          error: 'Unknown action'
        }));
        break;
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});
//check all user
app.get('/api/users', async (req, res) => {
  try {
    const users = await knex('users').select('*');
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('Error fetching users');
  }
});
//check  user by uniqueId
app.post('/api/users/detail', async (req, res) => {
  console.log(req.body);
  // return res.status(200).json(req.body);
  const { uniqueId } = req.body;
  try {
    const user = await knex('users').where({ uniqueId }).first();
    if (!user) {
      return res.status(400).send('User not found');
    }
    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('Error fetching users');
  }
});
//check  user by uniqueId
app.get('/api/users/?uniqueId', async (req, res) => {
  const {
    uniqueId
  } = req.params;
  try {
    const user = await knex('users').where({
      uniqueId
    }).first();
    if (user) {
      res.status(200).json(user);
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).send('Error fetching user');
  }
});
// get qr code by uniqueId
app.get('/api/user/:uniqueId/qr', async (req, res) => {
  const {
    uniqueId
  } = req.params;
  try {
    const user = await knex('users').where({
      uniqueId
    }).first();
    console.log(user);
    // return res.status(200).json(user);
    if (user && user.qr_code) {
      const qrCodeFilePath = path.join(__dirname, 'qrcodes', `${user.uniqueId}.png`);
      // console.log(qrCodeFilePath);
      res.sendFile(qrCodeFilePath);
    } else {
      res.status(404).send('QR code not found');
    }
  } catch (error) {
    console.error('Error fetching QR code:', error);
    res.status(500).send('Error fetching QR code');
  }
});
// Confirm user by uniqueId and manage queue number
app.post('/api/admin/scan', async (req, res) => {
  const { code } = req.body;
  console.log(code);
  try {
    const user = await knex('users').where({ code }).first();
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Check if the user already has a queue number
    if (user.queue_number && user.queue_number.trim() !== '') {
      return res.status(400).send('User already has a queue number');
    }

    let prefix;
    if (user.type === 'iPhone 15 Pro Max') {
      prefix = 'A-';
    } else if (user.type === 'iPhone 15 Pro') {
      prefix = 'B-';
    } else if (user.type === 'iPhone 15 Plus') {
      prefix = 'C-';
    } else if (user.type === 'iPhone 15') {
      prefix = 'D-';
    } else {
      return res.status(400).send('Invalid user type');
    }

    // Find the latest queue number for the prefix
    const latestUser = await knex('users')
      .where('queue_number', 'like', `${prefix}%`)
      .orderBy('queue_number', 'desc')
      .first();

    let newNumber = '001';
    if (latestUser && latestUser.queue_number) {
      const latestNumber = latestUser.queue_number.replace(prefix, '');
      const nextNumber = parseInt(latestNumber) + 1;
      newNumber = String(nextNumber).padStart(3, '0');
    }

    // Update the user's queue number
    await knex('users')
      .where({ code: user.code })
      .update({
        queue_number: `${prefix}${newNumber}`,
      });

    console.log(`Added user to queue with number: ${prefix}${newNumber}`);
    res.status(200).json({
      uniqueId: user.uniqueId,
      customer_name: user.customer_name,
      product: user.product,
      queue_number: `${prefix}${newNumber}`,
    });
  } catch (error) {
    console.error('Error processing scan:', error);
    if (!res.headersSent) {
      res.status(500).send('Error processing scan');
    }
  }
});
// Confirm user by uniqueId
app.post('/api/admin/scan', async (req, res) => {
  const { code } = req.body;
  console.log(code);
  try {
    const user = await knex('users').where({ code }).first();
    if (user) {
      let prefix;
      if (user.type === 'iPhone 15 Pro Max') {
        prefix = 'A-';
      } else if (user.type === 'iPhone 15 Pro') {
        prefix = 'B-';
      } else if (user.type === 'iPhone 15 Plus') {
        prefix = 'C-';
      } else if (user.type === 'iPhone 15') {
        prefix = 'D-';
      } else {
        return res.status(400).send('Invalid user type');
      }

      // Find the latest queue number for the prefix
      const latestUser = await knex('users')
        .where('queue_number', 'like', `${prefix}%`)
        .orderBy('queue_number', 'desc')
        .first();

      let newNumber = '001';
      if (latestUser && latestUser.queue_number) {
        const latestNumber = latestUser.queue_number.replace(prefix, '');
        const nextNumber = parseInt(latestNumber) + 1;
        newNumber = String(nextNumber).padStart(3, '0');
      }

      await knex('users')
        .where({ code: user.code })
        .update({
          queue_number: `${prefix}${newNumber}`,
        });

      console.log(`Added user to queue with number: ${prefix}${newNumber}`);
      res.status(200).json({
        uniqueId: user.uniqueId,
        customer_name: user.customer_name,
        product: user.product,
        queue_number: `${prefix}${newNumber}`,
      });
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    console.error('Error processing scan:', error);
    if (!res.headersSent) {
      res.status(500).send('Error processing scan');
    }
  }
});
// control counter
app.post('/api/admin/queue-control', async (req, res) => {
  const { prefix, action } = req.body;

  if (!prefix || !action) {
    return res.status(400).send('Prefix and action are required');
  }

  try {
    const latestUser = await knex('users')
      .where('queue_number', 'like', `${prefix}%`)
      .orderBy('queue_number', 'desc')
      .first();

    if (!latestUser || !latestUser.queue_number) {
      return res.status(404).send('No users found with the specified prefix');
    }

    let newQueueNumber;

    if (action === 'increment') {
      const latestNumber = latestUser.queue_number.replace(prefix, '');
      const nextNumber = parseInt(latestNumber) + 1;
      newQueueNumber = `${prefix}${String(nextNumber).padStart(3, '0')}`;
    } else if (action === 'decrement') {
      const latestNumber = latestUser.queue_number.replace(prefix, '');
      let nextNumber = parseInt(latestNumber) - 1;
      if (nextNumber < 1) nextNumber = 1; // Ensure number doesn't go below 1
      newQueueNumber = `${prefix}${String(nextNumber).padStart(3, '0')}`;
    } else if (action === 'reset') {
      newQueueNumber = `${prefix}000`;
    } else if (action === 'delete') {
      newQueueNumber = ' '; // Set the queue_number to a space
    } else {
      return res.status(400).send('Invalid action');
    }

    await knex('users')
      .where('queue_number', 'like', `${prefix}%`)
      .orderBy('queue_number', 'desc')
      .first()
      .update({
        queue_number: newQueueNumber,
      });

    console.log(`Queue number updated to: ${newQueueNumber}`);
    res.status(200).send(`Queue number updated to: ${newQueueNumber}`);
  } catch (error) {
    console.error('Error controlling queue number:', error);
    res.status(500).send('Error controlling queue number');
  }
});
app.post('/api/invite', async (req, res) => {
  const {
    userIds
  } = req.body;

  try {
    let users;
    if (userIds && userIds.length > 0) {
      users = await knex('users').whereIn('id', userIds);
    } else {
      users = await knex('users').select('*');
    }

    if (users.length === 0) {
      return res.status(400).send('No users to invite');
    }

    for (const user of users) {
      const uniqueId = user.uniqueId;
      const qrData = `user:${uniqueId}-${Date.now()}`;
      const qrCodeFilePath = path.join(__dirname, 'qrcodes', `${qrData}.png`);

      // Generate QR Code and save to file
      await QRCode.toFile(qrCodeFilePath, qrData, {
        type: 'png'
      });

      // Update user record with generated QR code
      await knex('users').where({
        id: user.id
      }).update({
        qr_code: qrData,
        uniqueId: uniqueId,
      });

      // Send email with QR code
      const transporter = nodemailer.createTransport({
        host: 'smtp.hostinger.com',
        port: 465,
        secure: true,
        auth: {
          user: 'admin@mail.senimankode.id',
          pass: 'ITMaximum369#',
        },
      });

      const mailOptions = {
        from: 'admin@mail.senimankode.id',
        to: user.email,
        subject: 'Your Invitation',
        html: `<p>Scan the attached QR code to confirm your invitation.</p>`,
        attachments: [{
          filename: `${uniqueId}.png`,
          path: qrCodeFilePath,
          contentType: 'image/png',
        }, ],
      };

      await transporter.sendMail(mailOptions);
    }

    res.status(200).send('Invitations sent successfully');
  } catch (error) {
    console.error('Error sending invitations:', error);
    res.status(500).send('Error sending invitations');
  }
});
app.post('/api/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded');
    }

    const filePath = path.join(__dirname, 'uploads', req.file.filename);
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    
    for (const row of sheet) {
      const uniqueId = uuidv4();
      const randomEmail = `${uuidv4()}@example.com`;
      const qrData = `${uniqueId}`;
      const code = qrData;
      const qrCodeFilePath = path.join(__dirname, 'qrcodes', `${code}.png`);

      await knex('users').insert({
        queue_number: row['Queue Number'] || ' ', // Add random queue number if missing
        uniqueId: qrData, // Unique ID for each row
        email: randomEmail, // Randomized email
        phone: row.Phone || `${Math.floor(Math.random() * 10000)}`, // Default or value from sheet
        city: row.City || 'Jakarta', // Default to Jakarta if not present
        date: row.Date || new Date(), // Current date if not specified
        code: row.Code || qrData, // Default Code if missing
        service_category: row['Service Category'] || 'General Service', // Default Service Category
        service: row.Service || ' ', // Default Service
        counter: row.Counter || ' ', // Default Counter
        staff: row.Staff || 'Staff Member', // Default Staff
        customer_name: row['Customer Name'] || 'Anonymous', // Default Customer Name
        product: row.Product || 'Default Product', // Default Product
        type: row.Type || 'General', // Default Type
        storage: row.Storage || 'Main Storage', // Default Storage
        color: row.Color || 'No Color', // Default Color
        invoice: row.Invoice || `INV-${Math.floor(Math.random() * 10000)}`, // Randomized invoice if missing
        status: row.Status || 'invited', // Default status
        start_serving: row['Start Serving'] ? new Date(row['Start Serving']) : null, // Start Serving
        end_serving: row['End Serving'] ? new Date(row['End Serving']) : null, // End Serving
        qr_code_file_path: qrCodeFilePath // Save QR Code file path
      });
      

      // Generate the QR code and save it as a PNG file
      await QRCode.toFile(qrCodeFilePath, qrData, {
        type: 'png',
        width: 500,
        height: 500,
        margin: 1,
      });
    }
    res.status(200).send('Data imported successfully');
  } catch (error) {
    console.error('Error importing data:', error);
    res.status(500).send('Error importing data');
  }
});
app.post('/confirm', async (req, res) => {
  const {
    qr_code
  } = req.body;

  try {
    const user = await knex('users').where({
      qr_code
    }).first();

    if (user) {
      await knex('users').where({
        id: user.id
      }).update({
        status: 'queued'
      });
      say.speak(`User with email ${user.email} has been queued`);

      res.status(200).send('User queued successfully');
    } else {
      res.status(404).send('Invalid QR code');
    }
  } catch (error) {
    res.status(500).send('Error confirming user');
  }
});

// app.get('/api/users', async (req, res) => {
//   const { uniqueId } = req.query;
//   try {
//       const user = await knex('users').where({ uniqueId }).first();
//       if (user) {
//           res.status(200).json(user);
//       } else {
//           res.status(404).send('User not found');
//       }
//   } catch (error) {
//       console.error('Error fetching user:', error);
//       res.status(500).send('Error fetching user');
//   }
// });




app.listen(3000, () => console.log('Server running on port 3000'));