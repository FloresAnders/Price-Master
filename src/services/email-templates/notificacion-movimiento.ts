/**
 * Template de correo para notificación de movimientos en el Fondo General
 */

interface MovementData {
    company: string;
    providerName: string;
    providerCode: string;
    paymentType: string;
    invoiceNumber: string;
    amount: number;
    amountType: 'Egreso' | 'Ingreso';
    currency: 'CRC' | 'USD';
    manager: string;
    notes?: string;
    createdAt: string;
    operationType: 'create' | 'edit';
}

export function generateMovementNotificationEmail(data: MovementData): { subject: string; html: string; text: string } {
    const {
        company,
        providerName,
        providerCode,
        paymentType,
        invoiceNumber,
        amount,
        amountType,
        currency,
        manager,
        notes,
        createdAt,
        operationType,
    } = data;

    // Formatear el monto
    const currencySymbol = currency === 'USD' ? '$' : '₡';
    const formatter = currency === 'USD' 
        ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : new Intl.NumberFormat('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedAmount = `${currencySymbol} ${formatter.format(amount)}`;
    
    // Formatear la fecha
    const date = new Date(createdAt);
    const formattedDate = date.toLocaleString('es-CR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    const actionText = operationType === 'create' ? 'registrado' : 'editado';
    const subject = `Movimiento ${actionText} - ${providerName} - ${company}`;
    
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Movimiento ${actionText}</h2>
            <p>Se ha ${actionText} un movimiento en el Fondo General:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr style="background-color: #f5f5f5;">
                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Empresa:</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${company}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Proveedor:</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${providerName}</td>
                </tr>
                <tr style="background-color: #f5f5f5;">
                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Tipo:</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${paymentType}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>N° Factura:</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${invoiceNumber}</td>
                </tr>
                <tr style="background-color: #f5f5f5;">
                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>${amountType}:</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>${formattedAmount}</strong></td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Encargado:</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${manager}</td>
                </tr>
                ${notes ? `
                <tr style="background-color: #f5f5f5;">
                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Notas:</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${notes}</td>
                </tr>
                ` : ''}
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Fecha:</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${formattedDate}</td>
                </tr>
            </table>
            
            <p style="color: #666; font-size: 12px; margin-top: 20px;">
                Este es un correo automático generado por el sistema Time Master.
            </p>
        </div>
    `;

    const text = `
Movimiento ${actionText}

Se ha ${actionText} un movimiento en el Fondo General:

Empresa: ${company}
Proveedor: ${providerName}
Tipo: ${paymentType}
N° Factura: ${invoiceNumber}
${amountType}: ${formattedAmount}
Encargado: ${manager}
${notes ? `Notas: ${notes}` : ''}
Fecha: ${formattedDate}

---
Este es un correo automático generado por el sistema Time Master.
    `;

    return { subject, html, text };
}
