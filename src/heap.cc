#include "nan.h"

namespace heap {

using node::Buffer;
using v8::Handle;
using v8::Local;
using v8::Number;
using v8::Object;
using v8::Uint32;

static const int kPointerSize = sizeof(uint64_t);
static const int kAlign = 2 * sizeof(uint64_t);

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
    if ((tagged_src & 1) != 0)
      return NanThrowError("Unaligned src buffer");
    tagged_src |= 1;
  } else {
    tagged_src = args[1]->Uint32Value();
    if ((tagged_src & 0x7fffffff) != tagged_src)
      return NanThrowError("Too big number to be tagged");
    tagged_src <<= 1;
  }

  Local<Object> dst = args[0].As<Object>();
  uint32_t off = args[2]->Uint32Value();
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
  uint32_t off = args[1]->Uint32Value();

  uint64_t res = *reinterpret_cast<uint64_t*>(Buffer::Data(src) + off);

  // Untagged
  if ((res & 1) == 0) {
    if ((res & 0xffffffff) != res)
      return NanThrowError("Invalid untagged number");

    Local<Uint32> n = NanNew<Uint32, uint32_t>(res >> 1);
    return NanEscapeScope(n);
  }

  // Tagged
  res ^= 1;

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
  uint64_t page_size = args[1]->Uint32Value();
  uint32_t bit_count = args[2]->Uint32Value();

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
  uint32_t mark = args[1]->Uint32Value();
  uint64_t page_size = args[2]->Uint32Value();
  uint32_t bit_count = args[3]->Uint32Value();

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


static void Initialize(Handle<Object> target) {
  target->Set(NanNew("ptrSize"), NanNew<Number, uint32_t>(kPointerSize));
  target->Set(NanNew("align"), NanNew<Number, uint32_t>(kAlign));

  NODE_SET_METHOD(target, "writeTagged", WriteTagged);
  NODE_SET_METHOD(target, "readTagged", ReadTagged);
  NODE_SET_METHOD(target, "isSame", IsSame);
  NODE_SET_METHOD(target, "readMark", ReadMark);
  NODE_SET_METHOD(target, "writeMark", WriteMark);
}

NODE_MODULE(heap, Initialize);

}  // namespace heap
