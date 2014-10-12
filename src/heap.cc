#include "nan.h"

namespace heap {

using node::Buffer;
using v8::Handle;
using v8::Local;
using v8::Number;
using v8::Object;
using v8::Uint32;

NAN_METHOD(WriteTagged) {
  NanScope();

  if (args.Length() < 3 ||
      !args[0]->IsObject() ||
      !(args[1]->IsObject() || args[1]->IsNumber()) ||
      !args[2]->IsNumber()) {
    return NanThrowError("Missing args: writeTagged(dst, src, off)");
  }

  uint64_t tagged_src;

  if (args[1]->IsObject()) {
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

  if (args.Length() < 2 || !args[0]->IsObject() || !args[1]->IsNumber())
    return NanThrowError("Missing args: readTagged(src, off)");

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

  if (args.Length() < 2 || !args[0]->IsObject() || !args[1]->IsObject())
    return NanThrowError("Missing args: compare(a, b)");

  Local<Object> a = args[0].As<Object>();
  Local<Object> b = args[1].As<Object>();

  NanReturnValue(NanNew(Buffer::Data(a) == Buffer::Data(b)));
}


static void Initialize(Handle<Object> target) {
  target->Set(NanNew("ptrSize"), NanNew<Number, uint32_t>(sizeof(uint64_t)));

  NODE_SET_METHOD(target, "writeTagged", WriteTagged);
  NODE_SET_METHOD(target, "readTagged", ReadTagged);
  NODE_SET_METHOD(target, "isSame", IsSame);
}

NODE_MODULE(heap, Initialize);

}  // namespace heap
