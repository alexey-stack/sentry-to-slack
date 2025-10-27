export const config = {
    runtime: 'edge',
}

// 🚨 PASTE YOUR GOOGLE CHAT WEBHOOK URL HERE 🚨
// This is the URL from your Google Chat space (Apps & Integrations > Webhooks)
const GOOGLE_CHAT_WEBHOOK_URL = 'https://chat.googleapis.com/v1/spaces/AAQAzttXdrU/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=1jB4QDpJsfUaVdHPMfhfpTwbEOzzGmJei3Jr4DbO3FU';


// --- Helper Function to Extract Message ---
function extractLatestUserMessage(payload) {
    const breadcrumbValues = payload.event.breadcrumbs?.values;
    let latestUserMessage = "Message not found or N/A.";

    if (ArrayOfObjectsExists(breadcrumbValues)) {
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

// Helper to check for array existence and length
function ArrayOfObjectsExists(arr) {
    return Array.isArray(arr) && arr.length > 0;
}


// --- MAIN HANDLER ---
export default async (req) => {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const body = await req.json();
        
        // 1. EXTRACT DATA
        const userMessage = extractLatestUserMessage(body);

        const issueUrl = body.url;
        const userEmail = body.event?.user?.email || 'Unknown User';
        const projectSlug = body.project_slug;
        const environment = body.event?.environment || 'N/A';


        // --- CONSTRUCT GOOGLE CHAT MESSAGE (Card Format) ---
        const chatPayload = {
            // Using a text fallback for quick notification visibility
            text: `🚨 New Customer Report from ${userEmail} in ${projectSlug}!`,
            
            // Using cards for a rich, actionable message (Google Chat standard)
            cardsV2: [
                {
                    cardId: "sentry-report-card",
                    card: {
                        header: {
                            title: `🚨 New Customer Issue Report - ${projectSlug.toUpperCase()}`,
                            subtitle: `User: ${userEmail}`,
                            imageUrl: "https://sentry.io/images/sentry-logo.png"
                        },
                        sections: [
                            {
                                widgets: [
                                    {
                                        textParagraph: { 
                                            text: `**Environment:** ${environment} | **Sentry ID:** ${body.id}` 
                                        }
                                    },
                                    {
                                        // The core user message content
                                        textParagraph: { 
                                            text: `**User's Message:**\n${userMessage || "No message provided."}`
                                        }
                                    },
                                    {
                                        buttonList: {
                                            buttons: [
                                                {
                                                    text: "View Full Issue in Sentry",
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
            console.log(`[SUCCESS] Message sent to Google Chat for issue: ${body.id}`);
            return new Response('Webhook processed, message sent to Google Chat.', { status: 200 });
        } else {
            console.error(`[ERROR] Failed to send message to Google Chat. Status: ${response.status}`);
            // Still return 200 to Sentry to prevent webhook retries, as the issue is with Google Chat, not Sentry's payload.
            return new Response('Processed Sentry payload, but failed to notify Google Chat.', { status: 200 });
        }

    } catch (err) {
        // Log the error and return a 400 or 500 status to prevent Sentry retries if the payload is invalid.
        console.error('Error processing webhook:', err);
        return new Response(`Server error: ${err.message}`, { status: 500 });
    }
};
