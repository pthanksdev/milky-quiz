import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASS,
  },
});

transporter.verify((err) => {
  if (err) console.error('❌ Mailer error:', err.message);
  else console.log('✅ Mailer ready');
});
