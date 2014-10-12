{
  "targets": [{
    "target_name": "heap",
    "include_dirs": [
      "<!(node -e \"require('nan')\")",
    ],
    "sources": [
      "src/heap.cc",
    ],
  }],
}
