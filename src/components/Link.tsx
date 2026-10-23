import type {AnchorHTMLAttributes} from 'react';
import {navigate} from '../domain/router';
/** Настоящая ссылка: открывается в новой вкладке по Ctrl/⌘-клику, а обычный клик — без перезагрузки страницы. */
export default function Link({to,onClick,...props}:{to:string}&AnchorHTMLAttributes<HTMLAnchorElement>){return <a href={to} {...props} onClick={e=>{onClick?.(e);if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();navigate(to);}}/>;}
