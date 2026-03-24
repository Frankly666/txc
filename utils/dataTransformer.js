/**
 * 数据格式转换模块
 * 将兔小巢 API 返回的原始数据转换为 ifeedback 所需格式
 */

/**
 * 转换单条反馈数据
 * @param {Object} raw - 兔小巢 API 返回的单条 post 对象
 * @returns {Object} ifeedback 格式的对象
 */
function transformItem(raw) {
  const qqNumber = raw.field_values
    ? raw.field_values.find((f) => f.label === 'QQ')?.value || null
    : null;

  const date = new Date(raw.created_at);
  const pad = (n) => String(n).padStart(2, '0');
  const localTime = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

  const item = {
    time: localTime,
    uin: raw.id,
    QQ: qqNumber,
    comment: raw.content,
    nick_name: raw.nick_name,
  };

  // 图片
  if (raw.images && raw.images.length > 0) {
    item.picurllist = raw.images.map((img) => img.original_url).join('|');
  }

  // extra 字段中的客户端信息
  if (raw.extra) {
    const extraFields = [
      'clientInfo',
      'clientVersion',
      'os',
      'osVersion',
      'netType',
      'customInfo',
      'user_agent',
    ];
    for (const field of extraFields) {
      if (raw.extra[field]) {
        item[field] = raw.extra[field];
      }
    }
  }

  return item;
}

/**
 * 批量转换反馈数据
 * @param {Array} items - 兔小巢 API 返回的 data 数组
 * @returns {Array} ifeedback 格式的数组
 */
function transformBatch(items) {
  if (!Array.isArray(items)) return [];
  return items.map(transformItem);
}

module.exports = {
  transformItem,
  transformBatch,
};
