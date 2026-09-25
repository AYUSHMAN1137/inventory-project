import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, LockKeyhole, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LoginModalProps { isOpen: boolean; onClose: () => void }

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { login } = useAuth();
  const [collegeId,setCollegeId]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[submitting,setSubmitting]=useState(false);
  const idRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(isOpen)idRef.current?.focus()},[isOpen]);
  if(!isOpen)return null;
  const submit=async(event:React.FormEvent)=>{event.preventDefault();setSubmitting(true);setError('');try{await login(collegeId,password);onClose()}catch(cause){setError(cause instanceof Error?cause.message:'Sign in failed')}finally{setSubmitting(false)}};
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose()}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="login-title"><header className="modal-head"><div><span className="modal-kicker">Secure internal access</span><h2 id="login-title">Sign in to the lab</h2><p>Use the account provided by your lab administrator.</p></div><button className="icon-button" aria-label="Close sign in" onClick={onClose}><X size={19}/></button></header>{error&&<div className="error-banner" role="alert"><AlertCircle size={17}/>{error}</div>}<form onSubmit={submit} className="form-stack"><label>College ID<input ref={idRef} autoComplete="username" value={collegeId} onChange={e=>setCollegeId(e.target.value)} placeholder="Your college ID" required/></label><label>Password<div className="input-icon"><LockKeyhole size={17}/><input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" required/></div></label><button className="primary-action full-width" disabled={submitting}>{submitting?'Signing in…':'Sign in'}<ArrowRight size={17}/></button></form></section></div>;
}
