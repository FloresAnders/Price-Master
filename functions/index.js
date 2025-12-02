const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

// Inicializar Firebase Admin
admin.initializeApp();

/**
 * Cloud Function que se dispara cuando se crea un documento en la colección 'emails'
 * Procesa y envía el email usando nodemailer
 */
exports.sendEmailTrigger = onDocumentCreated("emails/{emailId}", async (event) => {
  const emailData = event.data.data();
  const emailId = event.params.emailId;

  console.log(`📧 Processing email ${emailId}:`, {
    to: emailData.to,
    subject: emailData.subject,
  });

  try {
    // Validar datos requeridos
    if (!emailData.to || !emailData.subject) {
      throw new Error("Missing required email fields: to, subject");
    }

    // Configurar transporter de nodemailer
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
      pool: true,
      maxConnections: 1,
      rateDelta: 20000,
      rateLimit: 5,
    });

    // Preparar opciones del email
    const mailOptions = {
      from: {
        name: "Time Master System",
        address: process.env.GMAIL_USER || "",
      },
      to: emailData.to,
      subject: emailData.subject,
      text: emailData.text || "",
      html: emailData.html || `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h2 style="color: #333; margin-bottom: 20px;">Time Master System</h2>
            <div style="background-color: white; padding: 20px; border-radius: 6px; border-left: 4px solid #007bff;">
              ${(emailData.text || "").replace(/\n/g, "<br>")}
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
      attachments: emailData.attachments || [],
      headers: {
        "X-Priority": "3",
        "X-MSMail-Priority": "Normal",
        "Importance": "Normal",
        "X-Mailer": "Time Master System",
        "Reply-To": process.env.GMAIL_USER || "",
      },
      messageId: `<${Date.now()}.${Math.random().toString(36).substr(2, 9)}@pricemaster.local>`,
      date: new Date(),
    };

    // Enviar email
    const info = await transporter.sendMail(mailOptions);

    console.log("✅ Email sent successfully:", info.messageId);

    // Actualizar documento en Firestore con el estado
    await admin.firestore().collection("emails").doc(emailId).update({
      status: "sent",
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      messageId: info.messageId,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Error sending email:", error);

    // Actualizar documento con el error
    await admin.firestore().collection("emails").doc(emailId).update({
      status: "failed",
      error: error.message,
      failedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // No lanzar error para evitar reintentos automáticos infinitos
    // Firebase Functions reintenta automáticamente en caso de error
    return { success: false, error: error.message };
  }
});

/**
 * Función auxiliar para verificar la configuración del sistema de emails
 * Puede ser llamada manualmente para diagnóstico
 */
exports.checkEmailConfig = require("firebase-functions/v2/https").onRequest(
  async (req, res) => {
    const hasGmailUser = !!process.env.GMAIL_USER;
    const hasGmailPassword = !!process.env.GMAIL_APP_PASSWORD;

    res.json({
      configured: hasGmailUser && hasGmailPassword,
      gmailUser: hasGmailUser ? process.env.GMAIL_USER : "NOT_SET",
      gmailPassword: hasGmailPassword ? "SET" : "NOT_SET",
      timestamp: new Date().toISOString(),
    });
  }
);
