// Minimal JSON-stat 2.0 reader.
// Spec: https://json-stat.org/full/
//
// JSON-stat encodes a multi-dimensional dataset as:
//   - dimension: { dimName: { category: { index: {code: pos} OR [code, ...] } } }
//   - id: [dimName, ...]                 dimension order
//   - size: [n1, n2, ...]                size per dimension (same order as id)
//   - value: { "0": v0, "1": v1, ... }   flat values, row-major over dims
//
// iterJsonStat yields { value, <dim1>: code, <dim2>: code, ... } objects.

export function* iterJsonStat(payload) {
  if (!payload || !payload.id || !payload.size) return;

  const dimNames = payload.id;
  const sizes = payload.size;
  const dimIndices = dimNames.map((name) => {
    const cat = payload.dimension[name].category;
    if (Array.isArray(cat.index)) return cat.index;
    return Object.entries(cat.index)
      .sort((a, b) => a[1] - b[1])
      .map(([code]) => code);
  });

  const total = sizes.reduce((a, b) => a * b, 1);
  const values = payload.value || {};

  for (let i = 0; i < total; i++) {
    const v = values[i];
    if (v == null) continue;
    let rem = i;
    const row = { value: Number(v) };
    for (let d = sizes.length - 1; d >= 0; d--) {
      const dimSize = sizes[d];
      const pos = rem % dimSize;
      rem = Math.floor(rem / dimSize);
      row[dimNames[d]] = dimIndices[d][pos];
    }
    yield row;
  }
}
