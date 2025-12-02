/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const nodemailer = require('nodemailer');

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// Email sending function triggered by Firestore document creation
exports.sendEmailTrigger = onDocumentCreated("emails/{emailId}", async (event) => {
  const emailData = event.data.data();

  if (!emailData) {
    logger.error("No email data found");
    return;
  }

  try {
    await sendEmail(emailData);
    logger.info("Email sent successfully", { emailId: event.params.emailId });
  } catch (error) {
    logger.error("Error sending email", { error: error.message, emailId: event.params.emailId });
    throw error;
  }
});

// Email sending logic
async function sendEmail(emailData) {
  const { to, subject, text, html, attachments } = emailData;

  // Create transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    pool: true,
    maxConnections: 1,
    rateDelta: 20000,
    rateLimit: 5,
  });

  // Prepare mail options
  const mailOptions = {
    from: {
      name: 'Time Master System',
      address: process.env.GMAIL_USER || '',
    },
    to,
    subject,
    text,
    html: html || `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h2 style="color: #333; margin-bottom: 20px;">Time Master System</h2>
          <div style="background-color: white; padding: 20px; border-radius: 6px; border-left: 4px solid #007bff;">
            ${text.replace(/\n/g, '<br>')}
          </div>
          <div style="margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 6px;">
            <p style="margin: 0; font-size: 12px; color: #6c757d;">
              Este correo fue enviado desde el sistema Time Master.
              Si no esperabas recibir este mensaje, por favor ignóralo.
            </p>
          </div>
        </div>
      </div>
    `,
    attachments: attachments || [],
    headers: {
      'X-Priority': '3',
      'X-MSMail-Priority': 'Normal',
      'Importance': 'Normal',
      'X-Mailer': 'Time Master System',
      'Reply-To': process.env.GMAIL_USER || '',
    },
    messageId: `<${Date.now()}.${Math.random().toString(36).substr(2, 9)}@pricemaster.local>`,
    date: new Date(),
  };

  // Send email
  await transporter.sendMail(mailOptions);
}
