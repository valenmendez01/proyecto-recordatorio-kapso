// app/test-signup/page.tsx
"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

export default function TestSignupPage() {
  const [sessionResponse, setSessionResponse] = useState("");
  const [sdkResponse, setSdkResponse] = useState("");

  useEffect(() => {
    // 1. Session logging message event listener (Lógica de Meta)
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") {
        return;
      }
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          if (data.event === 'FINISH') {
            const { phone_number_id, waba_id } = data.data;
            console.log("Phone number ID ", phone_number_id, " WhatsApp business account ID ", waba_id);
          } else if (data.event === 'CANCEL') {
            const { current_step } = data.data;
            console.warn("Cancel at ", current_step);
          } else if (data.event === 'ERROR') {
            const { error_message } = data.data;
            console.error("error ", error_message);
          }
        }
        setSessionResponse(JSON.stringify(data, null, 2));
      } catch {
        console.log('Non JSON Responses', event.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // 2. Response callback (Lógica de Meta)
  const fbLoginCallback = (response: any) => {
    setSdkResponse(JSON.stringify(response, null, 2));
    if (response.authResponse) {
      const code = response.authResponse.code;
      console.log("Code recibido para el backend:", code);
    }
  };

  // 3. Launch method (Lógica y Valores de Meta)
  const launchWhatsAppSignup = () => {
    // @ts-ignore
    window.FB.login(fbLoginCallback, {
      config_id: '917915447312424', // ID de configuración proporcionado
      response_type: 'code',
      override_default_response_type: true,
      extras: {
        "version": "v3",
        "setup": {
          "business": {
            "id": null,
            "name": "Recordatorios Coexistence",
            "email": "info@odontologabetianamorante.com.ar",
            "phone": {},
            "address": {},
            "timezone": null
          },
          "phone": { "category": null, "description": "" },
        },
        "featureType": "whatsapp_business_app_onboarding",
        "sessionInfoVersion": "3"
      }
    });
  };

  return (
    <div className="p-8 font-sans">
      <div id="fb-root"></div>
      
      {/* Carga e inicialización del SDK con los valores específicos */}
      <Script
        id="fb-sdk-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.fbAsyncInit = function() {
              FB.init({
                appId            : '4424182717803111', 
                autoLogAppEvents : true,
                xfbml            : true,
                version          : 'v25.0'
              });
            };
          `,
        }}
      />
      <Script
        src="https://connect.facebook.net/en_US/sdk.js"
        strategy="afterInteractive"
      />

      <h1 className="text-xl font-bold mb-4">Prueba de Registro Insertado</h1>
      
      <button 
        onClick={launchWhatsAppSignup}
        style={{
          backgroundColor: '#1877f2',
          border: '0',
          borderRadius: '4px',
          color: '#fff',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 'bold',
          height: '40px',
          padding: '0 24px'
        }}
      >
        Login with Facebook
      </button>

      <div className="mt-8 space-y-4">
        <div>
          <p className="font-bold">Session info response:</p>
          <pre className="bg-gray-100 p-4 rounded mt-2 overflow-auto max-h-64 text-xs text-black">
            {sessionResponse || "Esperando evento..."}
          </pre>
        </div>

        <div>
          <p className="font-bold">SDK response:</p>
          <pre className="bg-gray-100 p-4 rounded mt-2 overflow-auto max-h-64 text-xs text-black">
            {sdkResponse || "Esperando respuesta..."}
          </pre>
        </div>
      </div>
    </div>
  );
}