"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import AuthCard from "@/components/auth/AuthCard";
import GoogleAuthButton from "@/components/auth/GoogleAuthButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage(){
  const router=useRouter(); const[email,setEmail]=useState(""); const[password,setPassword]=useState(""); const[show,setShow]=useState(false); const[loading,setLoading]=useState(false); const[error,setError]=useState("");
  const submit=async(e:FormEvent)=>{e.preventDefault();setError("");if(!email.trim()||!password){setError("Enter your email and password.");return;}setLoading(true);try{const result=await signIn("credentials",{email,password,redirect:false});if(!result||result.error){setError(result?.error||"We could not sign you in. Check your details and try again.");return;}router.push("/app/dashboard");router.refresh();}finally{setLoading(false)}};
  return <AuthShell><AuthCard title="Welcome back" description="Sign in to continue to your publishing workspace." footer={<>New to AI Article Publisher? <Link href="/register" className="font-semibold text-blue-700">Create an account</Link></>}><GoogleAuthButton/><div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-slate-200"/><span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">or continue with email</span><span className="h-px flex-1 bg-slate-200"/></div><form onSubmit={submit} className="space-y-4"><div><Label>Email address</Label><div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><Input type="email" className="pl-9" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email"/></div></div><div><div className="flex items-center justify-between"><Label>Password</Label><Link href="/forgot-password" className="mb-1.5 text-[11px] font-semibold text-blue-700">Forgot password?</Link></div><div className="relative"><LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><Input type={show?"text":"password"} className="px-9" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password"/><button type="button" aria-label={show?"Hide password":"Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" onClick={()=>setShow(!show)}>{show?<EyeOff className="h-4 w-4"/>:<Eye className="h-4 w-4"/>}</button></div></div>{error?<p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>:null}<Button className="w-full" type="submit" disabled={loading}>{loading?<Loader2 className="h-4 w-4 animate-spin"/>:null}{loading?"Signing in...":"Sign in"}</Button></form></AuthCard></AuthShell>
}
