export const config = {
    runtime: 'edge',
}

// 🚨 PASTE YOUR GOOGLE CHAT WEBHOOK URL HERE 🚨
const GOOGLE_CHAT_WEBHOOK_URL = 'https://chat.googleapis.com/v1/spaces/AAQAzttXdrU/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=1jB4QDpJsfUaVdHPMfhfpTwbEOzzGmJei3Jr4DbO3FU';


// --- Helper Function to Extract Message ---
function extractLatestUserMessage(payload) {
    const breadcrumbValues = payload.event.breadcrumbs?.values;
    let latestUserMessage = "N/A"; // Default if message is not found

    if (Array.isArray(breadcrumbValues) && breadcrumbValues.length > 0) {
        const lastBreadcrumb = breadcrumbValues[breadcrumbValues.length - 1];
        const message = lastBreadcrumb.message;
        const category = lastBreadcrumb.category;

        if (category === "customerReport" && message) {
            const separator = "Customer Issue Report:";
            const separatorIndex = message.indexOf(separator);
            
            if (separatorIndex !== -1) {
                // Slice and trim to get just the user's input
                latestUserMessage = message.substring(separatorIndex + separator.length).trim();
            } else {
                latestUserMessage = message.trim();
            }
        }
    }
    return latestUserMessage;
}


export default async (req) => {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const body = await req.json();
        
        // 1. EXTRACT REQUIRED DATA
        const userMessage = extractLatestUserMessage(body);

        // Safely extract core Sentry data
        const userEmail = body.event?.user?.email || 'Unknown User';
        const projectSlug = body.project_slug;
        const release = body.event?.release || 'N/A';
        const issueUrl = body.url;


        // --- CONSTRUCT GOOGLE CHAT MESSAGE (Simple Card Structure) ---
        // Using <br> for line breaks and <b> for bolding, as required by Chat Cards.
        let cardText = `<b>New Customer Report in ${projectSlug.toUpperCase()}</b><br>`;
        cardText += `<b>Release:</b> ${release}<br>`;
        cardText += `<b>User Email:</b> ${userEmail}<br>`;
        
        // Add the optional message only if it was found
        if (userMessage !== "N/A") {
             cardText += `<b>User Message:</b> ${userMessage}<br>`;
        }

        const chatPayload = {
            cardsV2: [
                {
                    cardId: "simple-sentry-alert",
                    card: {
                        sections: [
                            {
                                widgets: [
                                    {
                                        textParagraph: { 
                                            text: cardText 
                                        }
                                    },
                                    {
                                        buttonList: {
                                            buttons: [
                                                {
                                                    text: "VIEW ISSUE",
                                                    onClick: {
                                                        openLink: { url: issueUrl }
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                }
            ]
        };
        // -----------------------------------------------------------


        // 2. SEND MESSAGE TO GOOGLE CHAT
        const response = await fetch(GOOGLE_CHAT_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(chatPayload),
        });

        // 3. RESPOND TO SENTRY
        if (response.ok) {
            return new Response('Webhook processed, message sent to Google Chat.', { status: 200 });
        } else {
            console.error(`[ERROR] Failed to send message to Google Chat. Status: ${response.status}`);
            return new Response('Processed Sentry payload, but failed to notify Google Chat.', { status: 200 });
        }

    } catch (err) {
        console.error('Error processing webhook:', err);
        return new Response(`Server error: ${err.message}`, { status: 500 });
    }
};
