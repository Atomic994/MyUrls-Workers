// 生成随机后缀的函数
function generateRandomSuffix(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function handleRequest(request) {
  const url = new URL(request.url);
  let targetUrl;
  let customSuffix;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // 允许任意来源（你可以替换为指定的域名以限制来源）
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', // 允许的方法
    'Access-Control-Allow-Headers': 'Content-Type', // 允许的自定义头部
    'Content-Type': 'application/json' // 默认的响应类型
};
  // 检查是否设置了 LINKS 环境变量
  if (typeof LINKS === 'undefined' || !LINKS) {
    return new Response(JSON.stringify({
      Code: 500,
      Message: '请去Workers控制台-设置 将变量名称设定为“LINKS”并绑定KV命名空间然后重试部署！'
    }), {
      status: 200,
      headers:  corsHeaders 
    });
  }

  // 检查请求方法，GET 或 POST
  if (request.method === 'GET') {
    targetUrl = url.searchParams.get('longUrl');  // 获取长链接
    customSuffix = url.searchParams.get('shortKey');  // 获取自定义后缀
  } else if (request.method === 'POST') {
    const formData = await request.formData();  // 解析表单数据
    targetUrl = formData.get('longUrl');  // 获取长链接
    customSuffix = formData.get('shortKey');  // 获取自定义后缀
  }

  // 如果没有传入目标URL，返回错误
  if (!targetUrl) {
    return new Response(JSON.stringify({
      Code: 201,
      Message: 'failed to get long URL, please check the short URL if exists or expired' 
    }), {
      status: 200,
      headers: corsHeaders
    });
  }

  // 将 Base64 编码的 longUrl 解码
  try {
    targetUrl = atob(targetUrl);  // 使用 atob 进行 Base64 解码
  } catch (error) {
    return new Response(JSON.stringify({
      Code: 201,
      Message: 'failed to decode long URL, please check if it is properly encoded' 
    }), {
      status: 200,
      headers: corsHeaders
    });
  }

  // 如果指定了自定义后缀，则使用它；否则生成一个随机后缀
  const suffix = customSuffix || generateRandomSuffix(5);  // 默认6位随机后缀

  // 获取当前 Worker 的域名
  const workerDomain = request.headers.get('host');  // 获取当前访问的域名

  // 检查 KV 存储中是否已存在该自定义后缀
  const existingUrl = await LINKS.get(suffix);
  if (existingUrl) {
    return new Response(JSON.stringify({
      Code: 201,
      Message: 'short key already exists, please use another one or leave it empty to generate automatically.'
    }), {
      status: 200,
      headers: corsHeaders
    });
  }

  // 构建短链接
  const shortLink = `https://${workerDomain}/${suffix}`;

  // 将短链接映射到目标URL，存储到 KV 存储
  await LINKS.put(suffix, targetUrl);

  return new Response(JSON.stringify({
    Code: 1,
    ShortUrl: shortLink
  }), {
    status: 200,
    headers: corsHeaders
  });
}

async function handleRedirect(request) {
  const url = new URL(request.url);
  const suffix = url.pathname.split('/')[1];  // 获取短链接的后缀

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // 允许任意来源（你可以替换为指定的域名以限制来源）
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', // 允许的方法
    'Access-Control-Allow-Headers': 'Content-Type', // 允许的自定义头部
    'Content-Type': 'application/json' // 默认的响应类型
};
  // 检查是否设置了 LINKS 环境变量
  if (typeof LINKS === 'undefined' || !LINKS) {
    return new Response(JSON.stringify({
      Code: 500,
      Message: '请去Workers控制台-设置 将变量名称设定为“LINKS”并绑定KV命名空间然后重试部署！'
    }), {
      status: 200,
      headers: corsHeaders
    });
  }

  // 从 KV 存储中取出原始URL
  const targetUrl = await LINKS.get(suffix);

  if (targetUrl) {
    return Response.redirect(targetUrl, 301);  // 重定向到原始URL
  } else {
    return new Response('Short link not found', { status: 404 });
  }
}

// 处理不同的请求路径
addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname === '/') {
    // 根路径的请求
    event.respondWith(fetch(new Request('https://kiko923.github.io/MyUrls-Workers/')));
  } else if (url.pathname === '/short') {
    // 创建短链接
    event.respondWith(handleRequest(event.request));
  } else if (url.pathname.startsWith('/')) {
    // 跳转到原始链接（假设以 '/' 开头的路径是需要跳转的）
    event.respondWith(handleRedirect(event.request));
  } else {
    // 其他路径返回 404
    event.respondWith(new Response('Not Found', { status: 404 }));
  }
});
