import { useTranslation } from "../../context/TranslationContext";
import styles from "./Translation.module.css"

export default function TranslationList(){
    const {lines,recording,current,start,stop} = useTranslation()

    return (

        <div className={styles.page}>
            <div className={styles.card}>
                <h1 className={styles.title}>OpenAI Speech to Text Translation</h1>
                <p className={styles.subTitile}>Speak in any language and get translated into English</p>

                <button className={styles.btn} onClick={recording? stop: start}>
                    {recording ? "Stop Recording" : "Start Recording"}
                </button>

                <div className={styles.output}>
                    {!lines.length && (current && <p className={styles.placholder}>Translation will be shown here</p>)}
                    {lines.map((line,i)=> <div key={i} className={styles.line}>{line}</div>)}
                    {current && <div className={styles.streaming}>{current}</div>}
                </div>
            </div>
        </div>
    )

}