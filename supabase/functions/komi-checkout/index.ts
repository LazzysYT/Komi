// Authenticated invoice creation. Release is gated by server configuration.
Deno.serve(async(request: Request) => {
  if (request.method !== 'POST') return Response.json({error:'Method Not Allowed'},{status:405});
  return Response.json({error:'Checkout integration is not configured'},{status:503});
});
