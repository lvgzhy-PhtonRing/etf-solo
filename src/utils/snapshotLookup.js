// src/utils/snapshotLookup.js — 快照区间取值
/**
 * 返回 <= dateStr 的最后一个快照对象；没有则返回 null。
 * 注意返回对象而非 asset，调用方还需要 date 去算累计投入。
 */
export function snapshotOnOrBefore(snapshots, dateStr) {
  let res = null
  for (const s of snapshots || []) {
    if (s.date <= dateStr) res = s
  }
  return res
}
