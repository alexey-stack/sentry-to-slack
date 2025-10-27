export const config = {
  runtime: 'edge',
}

export default async (req) => {
  try {
    const body = await req.json()

    // Log full payload for debugging
    console.log('Incoming webhook payload:', body)

    // Destructure safely in case the structure changes
    const {
      project,
      culprit,
      event: {
        level,
        logentry: { formatted } = {},
        user: { email } = {},
        environment,
        metadata: { title } = {},
      } = {},
    } = body

    // Just log parsed info too
    console.info({
      level,
      formatted,
      environment,
      email,
      title,
      culprit,
      project,
    })

    return new Response('Payload logged to Vercel', { status: 200 })
  } catch (err) {
    console.error('Error processing webhook:', err)
    return new Response('Invalid payload', { status: 400 })
  }
}
