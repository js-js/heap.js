#include "nan.h"

#include <stdlib.h>

namespace heap {

using node::Buffer;
using v8::Array;
using v8::Handle;
using v8::Int32;
using v8::Local;
using v8::Number;
using v8::Object;
using v8::Value;

static const int kPointerSize = sizeof(uint64_t);
static const int kPointerShift = kPointerSize == 8 ? 3 : 2;
static const int kAlign = 2 * sizeof(uint64_t);
static const int kTagShift = 0x1;
static const int kTagMask = (1 << kTagShift) - 1;
static const int kTagPointer = 0x1;
static const int kTagSmi = 0x0;

NAN_METHOD(WriteTagged) {
  NanScope();

  if (args.Length() < 3 ||
      !Buffer::HasInstance(args[0]) ||
      !(Buffer::HasInstance(args[1]) || args[1]->IsNumber()) ||
      !args[2]->IsNumber()) {
    return NanThrowError("Missing args: writeTagged(dst, src, off)");
  }

  uint64_t tagged_src;

  if (Buffer::HasInstance(args[1])) {
    Local<Object> src = args[1].As<Object>();
    tagged_src = reinterpret_cast<intptr_t>(Buffer::Data(src));
    if ((tagged_src & kTagMask) == kTagPointer)
      return NanThrowError("Unaligned src buffer");
    tagged_src |= 1;
  } else {
    tagged_src = args[1]->Int32Value();
    if ((tagged_src & 0x7fffffff) != tagged_src)
      return NanThrowError("Too big number to be tagged");
    tagged_src <<= 1;
  }

  Local<Object> dst = args[0].As<Object>();
  uint32_t off = args[2]->Int32Value();
  memcpy(Buffer::Data(dst) + off,
         &tagged_src,
         sizeof(tagged_src));

  NanReturnUndefined();
}


static void DontDealloc(char* data, void* hint) {
}


NAN_METHOD(ReadTagged) {
  NanEscapableScope();

  if (args.Length() < 2 ||
      !Buffer::HasInstance(args[0]) ||
      !args[1]->IsNumber()) {
    return NanThrowError("Missing args: readTagged(src, off)");
  }

  Local<Object> src = args[0].As<Object>();
  uint32_t off = args[1]->Int32Value();

  uint64_t res = *reinterpret_cast<uint64_t*>(Buffer::Data(src) + off);

  // Untagged
  if ((res & kTagMask) == kTagSmi) {
    if ((res & 0xffffffff) != res)
      return NanThrowError("Invalid untagged number");

    Local<Int32> n = NanNew<Int32, uint32_t>(res >> 1);
    return NanEscapeScope(n);
  }

  // Tagged
  res ^= kTagPointer;

  // We don't know the length of the buffer ahead of time, so just assume that
  // it is almost infinite :)
  return NanEscapeScope(NanNewBufferHandle(
      reinterpret_cast<char*>(static_cast<intptr_t>(res)),
      0x3fffffff,
      DontDealloc,
      NULL));
}


NAN_METHOD(IsSame) {
  NanScope();

  if (args.Length() < 2 ||
      !Buffer::HasInstance(args[0]) ||
      !Buffer::HasInstance(args[1])) {
    return NanThrowError("Missing args: isSame(a, b)");
  }

  Local<Object> a = args[0].As<Object>();
  Local<Object> b = args[1].As<Object>();

  NanReturnValue(NanNew(Buffer::Data(a) == Buffer::Data(b)));
}


static uint64_t* GetMarkingWord(char* ptr,
                                int page_size,
                                int bit_count,
                                int* shift) {
  int bitfield_size = page_size * bit_count / (kPointerSize * kPointerSize);
  uint64_t raw_ptr = reinterpret_cast<intptr_t>(ptr);

  uint64_t bitfield = raw_ptr & ~(page_size - 1);
  uint64_t page = bitfield + bitfield_size;
  if ((page & (kAlign - 1)) != 0) {
    page |= (kAlign - 1);
    page++;
  }

  uint64_t bit_off = (raw_ptr - page) * bit_count / kPointerSize;
  *shift = bit_off & (kPointerSize - 1);
  return &reinterpret_cast<uint64_t*>(bitfield)[bit_off / kPointerSize];
}


NAN_METHOD(ReadMark) {
  NanEscapableScope();

  if (args.Length() < 3 ||
      !Buffer::HasInstance(args[0]) ||
      !args[1]->IsNumber() ||
      !args[2]->IsNumber()) {
    return NanThrowError("Missing args: readMark(obj, pageSize, bitCount)");
  }

  Local<Object> buf = args[0].As<Object>();
  uint64_t page_size = args[1]->Int32Value();
  uint32_t bit_count = args[2]->Int32Value();

  if ((page_size & (~(page_size - 1))) != page_size)
    return NanThrowError("Page size is not a power of two");

  int shift;
  uint64_t* word =
      GetMarkingWord(Buffer::Data(buf), page_size, bit_count, &shift);

  uint64_t res = *word;
  res >>= shift;
  res &= (1 << bit_count) - 1;

  Local<Number> result = NanNew<Number, uint32_t>(res);
  return NanEscapeScope(result);
}


NAN_METHOD(WriteMark) {
  NanScope();

  if (args.Length() < 4 ||
      !Buffer::HasInstance(args[0]) ||
      !args[1]->IsNumber() ||
      !args[2]->IsNumber() ||
      !args[3]->IsNumber()) {
    return NanThrowError(
        "Missing args: writeMark(obj, mark, pageSize, bitCount)");
  }

  Local<Object> buf = args[0].As<Object>();
  uint32_t mark = args[1]->Int32Value();
  uint64_t page_size = args[2]->Int32Value();
  uint32_t bit_count = args[3]->Int32Value();

  if ((page_size & (~(page_size - 1))) != page_size)
    return NanThrowError("Page size is not a power of two");

  int shift;
  uint64_t* word =
      GetMarkingWord(Buffer::Data(buf), page_size, bit_count, &shift);

  uint64_t res = *word;

  // Mask out any previous marking bits
  res &= ~(((1 << bit_count) - 1) << shift);

  // Set new value
  *word = res | (mark << shift);

  NanReturnUndefined();
}


NAN_METHOD(Call) {
  NanEscapableScope();

  typedef intptr_t (*Cb0)();
  typedef intptr_t (*Cb1)(intptr_t);
  typedef intptr_t (*Cb2)(intptr_t, intptr_t);
  typedef intptr_t (*Cb3)(intptr_t, intptr_t, intptr_t);
  typedef intptr_t (*Cb4)(intptr_t, intptr_t, intptr_t, intptr_t);
  typedef intptr_t (*Cb5)(intptr_t, intptr_t, intptr_t, intptr_t, intptr_t);
  typedef intptr_t (*Cb6)(intptr_t,
                          intptr_t,
                          intptr_t,
                          intptr_t,
                          intptr_t,
                          intptr_t);
  typedef intptr_t (*Cb7)(intptr_t,
                          intptr_t,
                          intptr_t,
                          intptr_t,
                          intptr_t,
                          intptr_t,
                          intptr_t);

  if (args.Length() < 2 || !Buffer::HasInstance(args[0]) || !args[1]->IsArray())
    return NanThrowError("Missing args: call(code, args)");

  char* code = Buffer::Data(args[0]);
  Local<Array> arr = args[1].As<Array>();

  if (arr->Length() > 7)
    return NanThrowError("Only args.length <= 6 is supported");

  intptr_t pargs[7];
  for (uint32_t i = 0; i < arr->Length(); i++) {
    Local<Value> arg = arr->Get(i);
    if (Buffer::HasInstance(arg)) {
      pargs[i] = reinterpret_cast<intptr_t>(Buffer::Data(arg));
      if ((pargs[i] & kTagMask) == kTagPointer)
        return NanThrowError("Unaligned pointer is given");

      pargs[i] |= kTagPointer;
    } else if (arg->IsNumber()) {
      pargs[i] = static_cast<intptr_t>(arg->Int32Value()) << kTagShift;
    } else {
      return NanThrowError("Each arg should be a buffer instance or number");
    }
  }

  intptr_t res;
  switch (arr->Length()) {
    case 0:
      res = reinterpret_cast<Cb0>(code)();
      break;
    case 1:
      res = reinterpret_cast<Cb1>(code)(pargs[0]);
      break;
    case 2:
      res = reinterpret_cast<Cb2>(code)(pargs[0], pargs[1]);
      break;
    case 3:
      res = reinterpret_cast<Cb3>(code)(pargs[0], pargs[1], pargs[2]);
      break;
    case 4:
      res = reinterpret_cast<Cb4>(code)(pargs[0], pargs[1], pargs[2], pargs[3]);
      break;
    case 5:
      res = reinterpret_cast<Cb5>(code)(
          pargs[0], pargs[1], pargs[2], pargs[3], pargs[4]);
      break;
    case 6:
      res = reinterpret_cast<Cb6>(code)(
          pargs[0], pargs[1], pargs[2], pargs[3], pargs[4], pargs[5]);
      break;
    case 7:
      res = reinterpret_cast<Cb7>(code)(
          pargs[0], pargs[1], pargs[2], pargs[3], pargs[4], pargs[5], pargs[6]);
      break;
    default:
      abort();
  }

  if ((res & kTagMask) == kTagPointer) {
    res ^= kTagPointer;
    return NanEscapeScope(NanNewBufferHandle(
        reinterpret_cast<char*>(res),
        0x3fffffff,
        DontDealloc,
        NULL));
  } else {
    Local<Int32> n = NanNew<Int32, int32_t>(res >> 1);
    return NanEscapeScope(n);
  }
}


NAN_METHOD(PointerAdd) {
  NanEscapableScope();

  if (args.Length() < 3 ||
      !Buffer::HasInstance(args[0]) ||
      !Buffer::HasInstance(args[1]) ||
      !args[2]->IsNumber()) {
    return NanThrowError(
        "Missing args: pointerAdd(pos, limit, size)");
  }

  intptr_t* pos = reinterpret_cast<intptr_t*>(Buffer::Data(args[0]));
  intptr_t* limit = reinterpret_cast<intptr_t*>(Buffer::Data(args[1]));
  int32_t size = args[2]->Int32Value();

  if (*pos + size > *limit)
    return NanFalse();

  intptr_t res = *pos;
  assert(res & kTagPointer);
  res ^= kTagPointer;
  *pos += size;
  if (size % kAlign != 0)
    *pos += kAlign - size % kAlign;

  return NanEscapeScope(NanNewBufferHandle(
      reinterpret_cast<char*>(res),
      size,
      DontDealloc,
      NULL));
}


static void Initialize(Handle<Object> target) {
  target->Set(NanNew("ptrSize"), NanNew<Number, uint32_t>(kPointerSize));
  target->Set(NanNew("ptrShift"), NanNew<Number, uint32_t>(kPointerShift));
  target->Set(NanNew("align"), NanNew<Number, uint32_t>(kAlign));
  target->Set(NanNew("tagShift"), NanNew<Number, uint32_t>(kTagShift));
  target->Set(NanNew("tagMask"), NanNew<Number, uint32_t>(kTagMask));
  target->Set(NanNew("tagPointer"), NanNew<Number, uint32_t>(kTagPointer));
  target->Set(NanNew("tagSmi"), NanNew<Number, uint32_t>(kTagSmi));

  NODE_SET_METHOD(target, "writeTagged", WriteTagged);
  NODE_SET_METHOD(target, "readTagged", ReadTagged);
  NODE_SET_METHOD(target, "isSame", IsSame);
  NODE_SET_METHOD(target, "readMark", ReadMark);
  NODE_SET_METHOD(target, "writeMark", WriteMark);
  NODE_SET_METHOD(target, "call", Call);
  NODE_SET_METHOD(target, "pointerAdd", PointerAdd);
}

NODE_MODULE(heap, Initialize);

}  // namespace heap
